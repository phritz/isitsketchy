// SERVER-ONLY entrypoint for the npm source. Kept separate from `client.ts`
// (which the `"use client"` UI imports) so the browser bundle never pulls in
// the server-only `serverApiClient`. This is the read-through call analysis
// makes; rows are created here as a side effect on a cache miss.
import { serverApiClient } from "@/lib/api-client.server";
import { ENDPOINT, toError, type NpmPackageResponse } from "./client";
import type { NpmPackageData } from "@/lib/npm";

export async function getNpmPackage(name: string): Promise<NpmPackageData> {
  try {
    const res = await serverApiClient.get<NpmPackageResponse>(ENDPOINT, {
      params: { name },
    });
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}
