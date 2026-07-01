// SERVER-ONLY detached orchestrator for an analysis run.
//
// runAnalysis(runId) is scheduled to run AFTER the POST /api/analysis response
// (via next/server `after`), on the persistent Node process. It runs in two
// phases: (1) discover subjects (source repo, its package, each direct
// dependency's package + linked repo) creating one pending AnalysisResult per
// applicable signal, then (2) compute every pending result sequentially. Source
// blobs fetched in phase 1 are held in memory and reused in phase 2.
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getGithubRepo } from "@/app/api/sources/github/client.server";
import { getNpmPackage } from "@/app/api/sources/npm/client.server";
import {
  normalizeUrl,
  parseOwnerRepo,
  type GithubRepoData,
} from "@/lib/github";
import type { NpmPackageData } from "@/lib/npm";
import {
  PACKAGE_SIGNALS,
  REPO_SIGNALS,
  type SignalDef,
} from "@/lib/analysis/signals";
import type { RiskScore, SubjectType } from "@/app/api/analysis/client";

type SubjectError = { code: string; message: string };

// Success = the source blob, keyed by subject type so phase 2 can pick the
// right registry. Subjects that failed to resolve are absent from this map.
type SubjectBlob =
  | { type: "repo"; blob: GithubRepoData }
  | { type: "package"; blob: NpmPackageData };

const DEP_GROUPS: string[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

// Best-effort resolution of a self-reported npm `repository.url` to a
// normalized github.com URL. Returns null for missing / non-github / shorthand
// URLs (in which case we simply create no repo subject).
function resolveGithubUrl(raw: string | null): string | null {
  if (raw === null || raw.trim().length === 0) {
    return null;
  }
  try {
    const normalized: string = normalizeUrl(raw);
    parseOwnerRepo(normalized);
    return normalized;
  } catch {
    return null;
  }
}

function enumerateDirectDeps(
  packageJson: Record<string, unknown> | null,
): string[] {
  if (packageJson === null) {
    return [];
  }
  const names: Set<string> = new Set<string>();
  for (const group of DEP_GROUPS) {
    const groupValue: unknown = packageJson[group];
    if (groupValue !== null && typeof groupValue === "object") {
      for (const name of Object.keys(groupValue as Record<string, unknown>)) {
        names.add(name);
      }
    }
  }
  return [...names];
}

async function githubRowId(normalizedUrl: string): Promise<string | null> {
  const row = await prisma.githubRepo.findUnique({
    where: { url: normalizedUrl },
  });
  return row?.id ?? null;
}

async function npmRowId(name: string): Promise<string | null> {
  const row = await prisma.npmPackage.findUnique({ where: { name } });
  return row?.id ?? null;
}

type CreateSubjectParams = {
  runId: string;
  type: SubjectType;
  name: string;
  githubRepoId: string | null;
  npmPackageId: string | null;
  repoUrl: string | null;
  error: SubjectError | null;
  signals: SignalDef<unknown>[];
};

async function createSubjectWithResults(
  params: CreateSubjectParams,
): Promise<string> {
  const subject = await prisma.analysisSubject.create({
    data: {
      analysisRunId: params.runId,
      type: params.type,
      name: params.name,
      githubRepoId: params.githubRepoId,
      npmPackageId: params.npmPackageId,
      repoUrl: params.repoUrl,
      error:
        params.error === null
          ? Prisma.JsonNull
          : (params.error as unknown as Prisma.InputJsonValue),
      results: {
        create: params.signals.map((signal) => ({
          signalId: signal.id,
          name: signal.name,
        })),
      },
    },
  });
  return subject.id;
}

// Phase 1 discovery state, shared across the helpers below.
type Discovery = {
  runId: string;
  subjectBlobs: Map<string, SubjectBlob>;
  repoUrlToSubjectId: Map<string, string>;
  packageNames: Set<string>;
};

// Create (or reuse) a repo subject for a normalized github URL. Repo subjects
// are deduped by URL within a run, so a monorepo backing many packages is only
// analyzed once.
async function ensureRepoSubject(
  discovery: Discovery,
  normalizedUrl: string,
  blob: GithubRepoData,
): Promise<string> {
  const existing: string | undefined =
    discovery.repoUrlToSubjectId.get(normalizedUrl);
  if (existing !== undefined) {
    return existing;
  }
  const rowId: string | null = await githubRowId(normalizedUrl);
  const subjectId: string = await createSubjectWithResults({
    runId: discovery.runId,
    type: "repo",
    name: blob.repo.full_name,
    githubRepoId: rowId,
    npmPackageId: null,
    repoUrl: null,
    error: null,
    signals: REPO_SIGNALS as SignalDef<unknown>[],
  });
  discovery.repoUrlToSubjectId.set(normalizedUrl, subjectId);
  discovery.subjectBlobs.set(subjectId, { type: "repo", blob });
  return subjectId;
}

// Resolve and link the github repo a package self-reports, if any.
async function linkPackageRepo(
  discovery: Discovery,
  rawRepoUrl: string | null,
): Promise<void> {
  const normalized: string | null = resolveGithubUrl(rawRepoUrl);
  if (normalized === null || discovery.repoUrlToSubjectId.has(normalized)) {
    return;
  }
  try {
    const repoBlob: GithubRepoData = await getGithubRepo(normalized);
    await ensureRepoSubject(discovery, normalized, repoBlob);
  } catch {
    // Dependency repo unresolvable: create no repo subject for now.
  }
}

// Add a package subject. For the source package (isSource), a package that does
// not resolve on npm is simply skipped. For a dependency, the subject is always
// created and carries a per-subject error on resolution failure.
async function addPackageSubject(
  discovery: Discovery,
  name: string,
  isSource: boolean,
): Promise<void> {
  if (discovery.packageNames.has(name)) {
    return;
  }
  discovery.packageNames.add(name);

  let npmBlob: NpmPackageData | null = null;
  let error: SubjectError | null = null;
  try {
    npmBlob = await getNpmPackage(name);
  } catch (caught) {
    if (isSource) {
      return;
    }
    error = { code: "package_unresolvable", message: errorMessage(caught) };
  }

  const rowId: string | null = npmBlob === null ? null : await npmRowId(name);
  const rawRepoUrl: string | null =
    npmBlob?.packument.repository?.url ?? null;
  const subjectId: string = await createSubjectWithResults({
    runId: discovery.runId,
    type: "package",
    name,
    githubRepoId: null,
    npmPackageId: rowId,
    repoUrl: rawRepoUrl,
    error,
    signals: PACKAGE_SIGNALS as SignalDef<unknown>[],
  });

  if (npmBlob !== null) {
    discovery.subjectBlobs.set(subjectId, { type: "package", blob: npmBlob });
    await linkPackageRepo(discovery, rawRepoUrl);
  }
}

type SignalRunResult =
  | { ok: true; riskScore: RiskScore; comment: string }
  | { ok: false; message: string };

// The single try/catch that isolates a per-signal failure, so one bad signal
// records a `failed` result but never aborts the rest of the run.
function safeRunSignal(
  signalId: string,
  entry: SubjectBlob,
): SignalRunResult {
  try {
    if (entry.type === "repo") {
      const def = REPO_SIGNALS.find((signal) => signal.id === signalId);
      if (def === undefined) {
        return { ok: false, message: `Unknown repo signal: ${signalId}` };
      }
      const outcome = def.compute({ repo: entry.blob });
      return { ok: true, riskScore: outcome.riskScore, comment: outcome.comment };
    }
    const def = PACKAGE_SIGNALS.find((signal) => signal.id === signalId);
    if (def === undefined) {
      return { ok: false, message: `Unknown package signal: ${signalId}` };
    }
    const outcome = def.compute({ npmPackage: entry.blob });
    return { ok: true, riskScore: outcome.riskScore, comment: outcome.comment };
  } catch (caught) {
    return { ok: false, message: errorMessage(caught) };
  }
}

async function computePendingResults(discovery: Discovery): Promise<void> {
  const pending = await prisma.analysisResult.findMany({
    where: { subject: { analysisRunId: discovery.runId }, status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  for (const result of pending) {
    await prisma.analysisResult.update({
      where: { id: result.id },
      data: { status: "running" },
    });

    const entry: SubjectBlob | undefined = discovery.subjectBlobs.get(
      result.analysisSubjectId,
    );
    if (entry === undefined) {
      await prisma.analysisResult.update({
        where: { id: result.id },
        data: { status: "failed", comment: "Subject data unavailable" },
      });
      continue;
    }

    const outcome: SignalRunResult = safeRunSignal(result.signalId, entry);
    if (outcome.ok) {
      await prisma.analysisResult.update({
        where: { id: result.id },
        data: {
          status: "completed",
          riskScore: outcome.riskScore,
          comment: outcome.comment,
        },
      });
    } else {
      await prisma.analysisResult.update({
        where: { id: result.id },
        data: { status: "failed", comment: outcome.message },
      });
    }
  }
}

// A fatal, pre-subject failure (root repo/package unresolvable) recorded on the
// run itself so the detail page shows a run-level error and no subjects.
async function setFatalRunError(
  runId: string,
  code: string,
  message: string,
): Promise<void> {
  const fatal: SubjectError = { code, message };
  await prisma.analysisRun.update({
    where: { id: runId },
    data: { error: fatal as unknown as Prisma.InputJsonValue },
  });
}

// A package root distills only `dependencies` + `devDependencies` in its
// packument blob (unlike the repo path, which reads all four groups from the
// raw package.json). Dedup across the two groups.
function enumeratePackageDeps(blob: NpmPackageData): string[] {
  const names: Set<string> = new Set<string>();
  const latest: NpmPackageData["latest"] = blob.latest;
  if (latest !== null) {
    for (const name of Object.keys(latest.dependencies)) {
      names.add(name);
    }
    for (const name of Object.keys(latest.devDependencies)) {
      names.add(name);
    }
  }
  return [...names];
}

// Repo-rooted discovery: source repo (fatal on failure) + its own package +
// each direct dependency. Returns false when the root repo is unresolvable.
async function discoverRepoRoot(
  discovery: Discovery,
  repoUrl: string,
): Promise<boolean> {
  let sourceRepoBlob: GithubRepoData;
  try {
    sourceRepoBlob = await getGithubRepo(repoUrl);
  } catch (caught) {
    await setFatalRunError(
      discovery.runId,
      "repo_unresolvable",
      errorMessage(caught),
    );
    return false;
  }

  const sourceNormalized: string = normalizeUrl(repoUrl);
  await ensureRepoSubject(discovery, sourceNormalized, sourceRepoBlob);

  // The source's own package (optional) + each direct dependency.
  const packageJson: Record<string, unknown> | null =
    sourceRepoBlob.packageJson;
  const sourcePackageName: string | null =
    packageJson !== null && typeof packageJson.name === "string"
      ? packageJson.name
      : null;
  if (sourcePackageName !== null) {
    await addPackageSubject(discovery, sourcePackageName, true);
  }

  for (const depName of enumerateDirectDeps(packageJson)) {
    await addPackageSubject(discovery, depName, false);
  }
  return true;
}

// Package-rooted discovery: the root package (fatal on failure) + its linked
// repo + each direct dependency (each with its own linked repo). Returns false
// when the root package is unresolvable.
async function discoverPackageRoot(
  discovery: Discovery,
  packageName: string,
): Promise<boolean> {
  let rootBlob: NpmPackageData;
  try {
    rootBlob = await getNpmPackage(packageName);
  } catch (caught) {
    await setFatalRunError(
      discovery.runId,
      "package_unresolvable",
      errorMessage(caught),
    );
    return false;
  }

  discovery.packageNames.add(packageName);
  const rowId: string | null = await npmRowId(packageName);
  const rawRepoUrl: string | null =
    rootBlob.packument.repository?.url ?? null;
  const subjectId: string = await createSubjectWithResults({
    runId: discovery.runId,
    type: "package",
    name: packageName,
    githubRepoId: null,
    npmPackageId: rowId,
    repoUrl: rawRepoUrl,
    error: null,
    signals: PACKAGE_SIGNALS as SignalDef<unknown>[],
  });
  discovery.subjectBlobs.set(subjectId, { type: "package", blob: rootBlob });
  await linkPackageRepo(discovery, rawRepoUrl);

  for (const depName of enumeratePackageDeps(rootBlob)) {
    await addPackageSubject(discovery, depName, false);
  }
  return true;
}

async function discoverAndCompute(runId: string): Promise<void> {
  const run = await prisma.analysisRun.findUnique({ where: { id: runId } });
  if (run === null) {
    return;
  }

  const discovery: Discovery = {
    runId,
    subjectBlobs: new Map<string, SubjectBlob>(),
    repoUrlToSubjectId: new Map<string, string>(),
    packageNames: new Set<string>(),
  };

  // Phase 1: discover subjects from the run's root. A fatal root failure is
  // recorded on the run and stops the run before Phase 2.
  let ok: boolean;
  if (run.rootType === "package") {
    if (run.packageName === null) {
      await setFatalRunError(runId, "invalid_run", "Missing packageName");
      return;
    }
    ok = await discoverPackageRoot(discovery, run.packageName);
  } else {
    if (run.repoUrl === null) {
      await setFatalRunError(runId, "invalid_run", "Missing repoUrl");
      return;
    }
    ok = await discoverRepoRoot(discovery, run.repoUrl);
  }
  if (!ok) {
    return;
  }

  // Phase 2: compute every pending result sequentially.
  await computePendingResults(discovery);
}

// Never throws: on an unexpected failure it records a fatal run error so the
// detached scheduler (`after`) has nothing to swallow.
export async function runAnalysis(runId: string): Promise<void> {
  try {
    await discoverAndCompute(runId);
  } catch (caught) {
    const fatal: SubjectError = {
      code: "internal_error",
      message: errorMessage(caught),
    };
    try {
      await prisma.analysisRun.update({
        where: { id: runId },
        data: { error: fatal as unknown as Prisma.InputJsonValue },
      });
    } catch {
      // Nothing more we can do if even recording the error fails.
    }
  }
}
