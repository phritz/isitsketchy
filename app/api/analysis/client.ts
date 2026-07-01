// Endpoint entrypoint for /api/analysis (per AGENTS.md). Declares the shared
// constants, unions, status-derivation helper, request/response types, and the
// browser-facing client functions. Everything here is pure and browser-safe so
// the route handler, orchestrator, and UI can all import the types + helpers.
import { AxiosError } from "axios";
import { browserApiClient } from "@/lib/api-client.browser";

export const RISK_SCORES = ["red", "yellow", "green"] as const;
export type RiskScore = (typeof RISK_SCORES)[number];

export const RESULT_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const SUBJECT_TYPES = ["repo", "package"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

// What an AnalysisRun is rooted on: a GitHub repo URL or an npm package name.
export const ROOT_TYPES = ["repo", "package"] as const;
export type RootType = (typeof ROOT_TYPES)[number];

// Both a subject's status and the run's status are derived from results (there
// is no stored status column). See plan/analysis.md.
export function deriveStatus(
  results: { status: ResultStatus }[],
): ResultStatus {
  if (results.length === 0) return "pending";
  if (results.every((r) => r.status === "pending")) return "pending";
  if (
    results.every((r) => r.status === "completed" || r.status === "failed")
  ) {
    return results.every((r) => r.status === "failed") ? "failed" : "completed";
  }
  return "running";
}

export type AnalysisError = {
  code: string;
  message: string;
};

export type AnalysisResultData = {
  id: string;
  signalId: string;
  name: string;
  status: ResultStatus;
  riskScore: RiskScore | null;
  comment: string | null;
};

export type AnalysisSubjectData = {
  id: string;
  type: SubjectType;
  name: string;
  githubRepoId: string | null;
  npmPackageId: string | null;
  repoUrl: string | null;
  error: AnalysisError | null;
  status: ResultStatus;
  results: AnalysisResultData[];
};

export type AnalysisRunData = {
  id: string;
  rootType: RootType;
  repoUrl: string | null; // set when rootType == "repo"
  packageName: string | null; // set when rootType == "package"
  error: AnalysisError | null;
  status: ResultStatus;
  subjects: AnalysisSubjectData[];
  createdAt: string;
  updatedAt: string;
};

export type AnalysisRunSummary = {
  id: string;
  rootType: RootType;
  repoUrl: string | null;
  packageName: string | null;
  status: ResultStatus;
  subjectCount: number;
  createdAt: string;
  updatedAt: string;
};

// Exactly one of `repoUrl` / `packageName` is set, per `rootType`.
export type CreateAnalysisRequest = {
  repoUrl?: string;
  packageName?: string;
};

export type CreateAnalysisResponse = {
  ok: true;
  data: { id: string };
};

export type AnalysisRunResponse = {
  ok: true;
  data: AnalysisRunData;
};

export type ListAnalysesResponse = {
  ok: true;
  data: AnalysisRunSummary[];
};

export type ErrorResponse = {
  ok: false;
  error: { message: string };
};

export const ENDPOINT: string = "/api/analysis";

// Surface the server's `{ ok: false, error }` message instead of a generic
// axios status string.
export function toError(error: unknown): Error {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ErrorResponse | undefined;
    if (data && data.ok === false) {
      return new Error(data.error.message);
    }
  }
  return error instanceof Error ? error : new Error("Request failed");
}

export async function createAnalysis(repoUrl: string): Promise<{ id: string }> {
  try {
    const body: CreateAnalysisRequest = { repoUrl };
    const res = await browserApiClient.post<CreateAnalysisResponse>(
      ENDPOINT,
      body,
    );
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}

export async function createPackageAnalysis(
  packageName: string,
): Promise<{ id: string }> {
  try {
    const body: CreateAnalysisRequest = { packageName };
    const res = await browserApiClient.post<CreateAnalysisResponse>(
      ENDPOINT,
      body,
    );
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}

export async function getAnalysis(id: string): Promise<AnalysisRunData> {
  try {
    const res = await browserApiClient.get<AnalysisRunResponse>(ENDPOINT, {
      params: { id },
    });
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}

export async function listAnalyses(): Promise<AnalysisRunSummary[]> {
  try {
    const res = await browserApiClient.get<ListAnalysesResponse>(ENDPOINT);
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}
