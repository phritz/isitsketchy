// SERVER-ONLY entrypoint for the GitHub source. Kept separate from `client.ts`
// (which the `"use client"` UI imports) so the browser bundle never pulls in
// the server-only `serverApiClient`. This is the read-through call analysis
// makes; rows are created here as a side effect on a cache miss.
import { getServerApiClient } from "@/lib/api-client.server";
import { ENDPOINT, toError, type GithubRepoResponse } from "./client";
import type { GithubRepoData } from "@/lib/github";

export async function getGithubRepo(url: string): Promise<GithubRepoData> {
  try {
    const res = await getServerApiClient().get<GithubRepoResponse>(ENDPOINT, {
      params: { url },
    });
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}
