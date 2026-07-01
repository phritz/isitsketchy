import { browserApiClient } from "@/lib/api-client.browser";
import { toError } from "@/lib/errors";
import type { NpmPackageData } from "@/lib/npm";

export type { NpmPackageData } from "@/lib/npm";
export type { ErrorResponse } from "@/lib/errors";
export { toError };

export type NpmPackageMeta = {
  fetchedAt: string;
  cacheHit: boolean;
};

export type NpmPackageResponse = {
  ok: true;
  data: NpmPackageData;
  meta: NpmPackageMeta;
};

export type NpmPackageSummary = {
  id: string;
  name: string;
  fetchedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ListNpmPackagesResponse = {
  ok: true;
  data: NpmPackageSummary[];
};

export const ENDPOINT: string = "/api/sources/npm";

// Browser read-through fetch for a single package (used by the home page box).
// The analysis pipeline uses the server-side `getNpmPackage` in
// `client.server.ts` instead; rows are created here as a side effect on a miss.
export async function fetchNpmPackage(name: string): Promise<NpmPackageData> {
  try {
    const res = await browserApiClient.get<NpmPackageResponse>(ENDPOINT, {
      params: { name },
    });
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}

export async function listNpmPackages(): Promise<NpmPackageSummary[]> {
  try {
    const res = await browserApiClient.get<ListNpmPackagesResponse>(ENDPOINT);
    return res.data.data;
  } catch (error) {
    throw toError(error);
  }
}

export async function deleteNpmPackage(id: string): Promise<void> {
  try {
    await browserApiClient.delete(ENDPOINT, { params: { id } });
  } catch (error) {
    throw toError(error);
  }
}

export async function clearNpmPackages(): Promise<void> {
  try {
    await browserApiClient.delete(ENDPOINT, { params: { all: "true" } });
  } catch (error) {
    throw toError(error);
  }
}
