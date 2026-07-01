import { browserApiClient } from "@/lib/api-client.browser";
import { toError } from "@/lib/errors";
import type { GithubRepoData } from "@/lib/github";

export type { GithubRepoData } from "@/lib/github";
export type { ErrorResponse } from "@/lib/errors";
export { toError };

export type GithubRepoMeta = {
  fetchedAt: string;
  cacheHit: boolean;
};

export type GithubRepoResponse = {
  ok: true;
  data: GithubRepoData;
  meta: GithubRepoMeta;
};

export type GithubRepoSummary = {
  id: string;
  url: string;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ListGithubReposResponse = {
  ok: true;
  data: GithubRepoSummary[];
};

export const ENDPOINT: string = "/api/sources/github";

// Read-through fetch for a single repo. This is the call our own analysis code
// uses; rows are created here as a side effect on a cache miss.
export async function getGithubRepo(url: string): Promise<GithubRepoData> {
  try {
    const res = await browserApiClient.get<GithubRepoResponse>(ENDPOINT, {
      params: { url },
    });
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}

export async function listGithubRepos(): Promise<GithubRepoSummary[]> {
  try {
    const res = await browserApiClient.get<ListGithubReposResponse>(ENDPOINT);
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}

export async function deleteGithubRepo(id: string): Promise<void> {
  try {
    await browserApiClient.delete(ENDPOINT, { params: { id } });
  } catch (error) {
    throw toError(error);
  }
}

export async function clearGithubRepos(): Promise<void> {
  try {
    await browserApiClient.delete(ENDPOINT, { params: { all: "true" } });
  } catch (error) {
    throw toError(error);
  }
}
