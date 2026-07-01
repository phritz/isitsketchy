import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { GithubFetchError, normalizeUrl, parseOwnerRepo } from "@/lib/github";
import { NpmFetchError, validatePackageName } from "@/lib/npm";
import { runAnalysis } from "@/lib/analysis/orchestrator";
import { errorMessage } from "@/lib/errors";
import { errorResponse, NO_STORE_HEADERS } from "@/lib/api-response";
import {
  resolveStatus,
  type AnalysisError,
  type AnalysisResultData,
  type AnalysisRunData,
  type AnalysisRunResponse,
  type AnalysisRunSummary,
  type AnalysisSubjectData,
  type CreateAnalysisRequest,
  type CreateAnalysisResponse,
  type ErrorResponse,
  type ListAnalysesResponse,
  type ResultStatus,
  type RiskScore,
  type RootType,
  type SubjectType,
} from "./client";

export const dynamic = "force-dynamic";

function parseError(value: Prisma.JsonValue): AnalysisError | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const code: string =
    typeof record.code === "string" ? record.code : "error";
  const message: string =
    typeof record.message === "string" ? record.message : "Unknown error";
  return { code, message };
}

type ResultRow = {
  id: string;
  signalId: string;
  name: string;
  status: string;
  riskScore: string | null;
  comment: string | null;
};

type SubjectRow = {
  id: string;
  type: string;
  name: string;
  githubRepoId: string | null;
  npmPackageId: string | null;
  repoUrl: string | null;
  error: Prisma.JsonValue;
  results: ResultRow[];
};

function serializeResult(row: ResultRow): AnalysisResultData {
  return {
    id: row.id,
    signalId: row.signalId,
    name: row.name,
    status: row.status as ResultStatus,
    riskScore: row.riskScore as RiskScore | null,
    comment: row.comment,
  };
}

function serializeSubject(row: SubjectRow): AnalysisSubjectData {
  const results: AnalysisResultData[] = row.results.map(serializeResult);
  const error: AnalysisError | null = parseError(row.error);
  const status: ResultStatus = resolveStatus(error, results);
  return {
    id: row.id,
    type: row.type as SubjectType,
    name: row.name,
    githubRepoId: row.githubRepoId,
    npmPackageId: row.npmPackageId,
    repoUrl: row.repoUrl,
    error,
    status,
    results,
  };
}

async function createRun(
  request: NextRequest,
): Promise<NextResponse<CreateAnalysisResponse | ErrorResponse>> {
  const body = (await request.json()) as Partial<CreateAnalysisRequest>;
  const rawUrl: string =
    typeof body.repoUrl === "string" ? body.repoUrl.trim() : "";
  const rawPackageName: string =
    typeof body.packageName === "string" ? body.packageName.trim() : "";

  if (rawUrl.length === 0 && rawPackageName.length === 0) {
    return errorResponse("repoUrl or packageName is required", 400);
  }

  const data: { rootType: RootType; repoUrl?: string; packageName?: string } =
    rawPackageName.length > 0
      ? { rootType: "package", packageName: rawPackageName }
      : { rootType: "repo" };

  if (rawPackageName.length > 0) {
    validatePackageName(rawPackageName);
  } else {
    let normalized: string;
    try {
      normalized = normalizeUrl(rawUrl);
      parseOwnerRepo(normalized);
    } catch {
      return errorResponse("invalid_url", 400);
    }
    data.repoUrl = normalized;
  }

  const run = await prisma.analysisRun.create({ data });

  after(() => runAnalysis(run.id));

  const responseBody: CreateAnalysisResponse = {
    ok: true,
    data: { id: run.id },
  };
  return NextResponse.json(responseBody, { headers: NO_STORE_HEADERS });
}

async function getRun(
  id: string,
): Promise<NextResponse<AnalysisRunResponse | ErrorResponse>> {
  const run = await prisma.analysisRun.findUnique({
    where: { id },
    include: {
      subjects: {
        orderBy: { createdAt: "asc" },
        include: { results: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (run === null) {
    return errorResponse("not_found", 404);
  }

  const subjects: AnalysisSubjectData[] = run.subjects.map(serializeSubject);
  const runError: AnalysisError | null = parseError(run.error);
  const allResults: { status: ResultStatus }[] = subjects.flatMap(
    (subject) => subject.results,
  );
  const status: ResultStatus = resolveStatus(runError, allResults);

  const data: AnalysisRunData = {
    id: run.id,
    rootType: run.rootType as RootType,
    repoUrl: run.repoUrl,
    packageName: run.packageName,
    error: runError,
    status,
    subjects,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
  return NextResponse.json(
    { ok: true, data } satisfies AnalysisRunResponse,
    { headers: NO_STORE_HEADERS },
  );
}

async function listRuns(): Promise<NextResponse<ListAnalysesResponse>> {
  const runs = await prisma.analysisRun.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subjects: { include: { results: { select: { status: true } } } },
    },
  });

  const data: AnalysisRunSummary[] = runs.map((run) => {
    const runError: AnalysisError | null = parseError(run.error);
    const allResults: { status: ResultStatus }[] = run.subjects.flatMap(
      (subject) =>
        subject.results.map((result) => ({
          status: result.status as ResultStatus,
        })),
    );
    const status: ResultStatus = resolveStatus(runError, allResults);
    return {
      id: run.id,
      rootType: run.rootType as RootType,
      repoUrl: run.repoUrl,
      packageName: run.packageName,
      status,
      subjectCount: run.subjects.length,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };
  });

  return NextResponse.json(
    { ok: true, data } satisfies ListAnalysesResponse,
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<CreateAnalysisResponse | ErrorResponse>> {
  try {
    return await createRun(request);
  } catch (error) {
    if (error instanceof GithubFetchError || error instanceof NpmFetchError) {
      return errorResponse(error.code, error.status);
    }
    return errorResponse(errorMessage(error), 500);
  }
}

export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<AnalysisRunResponse | ListAnalysesResponse | ErrorResponse>
> {
  try {
    const id: string | null = request.nextUrl.searchParams.get("id");
    if (id && id.trim().length > 0) {
      return await getRun(id.trim());
    }
    return await listRuns();
  } catch (error) {
    return errorResponse(errorMessage(error), 500);
  }
}
