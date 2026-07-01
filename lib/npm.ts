// SERVER-ONLY npm registry client for the npm source cache.
//
// All outbound npm calls are paced through a shared RateLimiter so we stay
// polite to the public registry. npm publishes no hard rate limit, so the
// limit here is a conservative tunable (not a documented cap): it smooths
// bursts and keeps us well-behaved. registry.npmjs.org (packument) and
// api.npmjs.org (downloads) share this one bucket.
import axios, { AxiosError, type AxiosInstance } from "axios";
import validatePackageNameLib from "validate-npm-package-name";
import { RateLimiter, systemClock } from "@/lib/rate-limiter";

// Bump when the cached `data` shape changes so stale rows are recognizable.
export const NPM_SCHEMA_VERSION: number = 1;

export type NpmMaintainer = {
  name: string;
  email: string | null;
};

export type NpmDist = {
  tarball: string | null;
  integrity: string | null;
  shasum: string | null;
  unpackedSize: number | null;
  fileCount: number | null;
  signatures: unknown | null;
  attestations: unknown | null;
};

// The latest version's manifest subset (from versions[dist-tags.latest]).
export type NpmLatestManifest = {
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  engines: Record<string, string> | null;
  dist: NpmDist;
};

// Distilled packument fields we control.
export type NpmPackument = {
  name: string;
  description: string | null;
  distTagLatest: string | null;
  maintainers: NpmMaintainer[];
  license: string | null;
  homepage: string | null;
  repository: NpmRepository | null;
  time: NpmTime;
};

export type NpmRepository = {
  type: string | null;
  url: string | null;
};

// `time.created`, `time.modified`, plus a per-version publish-time map.
export type NpmTime = {
  created: string | null;
  modified: string | null;
  versions: Record<string, string>;
};

export type NpmDownloads = {
  lastWeek: number | null;
  lastMonth: number | null;
};

// The versioned jsonb blob stored in `NpmPackage.data`.
export type NpmPackageData = {
  schemaVersion: number;
  packument: NpmPackument;
  latest: NpmLatestManifest | null;
  downloads: NpmDownloads | null;
};

// Distinguishes expected upstream conditions (bad name, missing package) from
// unexpected failures so the route can pick an appropriate status code.
export class NpmFetchError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "NpmFetchError";
    this.code = code;
    this.status = status;
  }
}

// npm has no documented rate cap; this is a conservative politeness tunable
// that also smooths bursts. registry + downloads share this one bucket.
const npmRegistryLimiter: RateLimiter = new RateLimiter({
  name: "npm-registry",
  limitPerMinute: 120,
  clock: systemClock,
});

// Built lazily and memoized so all requests share one instance. No auth: the
// npm registry and downloads APIs are public.
let registryApiInstance: AxiosInstance | null = null;
let downloadsApiInstance: AxiosInstance | null = null;

function registryApi(): AxiosInstance {
  if (registryApiInstance === null) {
    registryApiInstance = axios.create({
      baseURL: "https://registry.npmjs.org",
    });
  }
  return registryApiInstance;
}

function downloadsApi(): AxiosInstance {
  if (downloadsApiInstance === null) {
    downloadsApiInstance = axios.create({
      baseURL: "https://api.npmjs.org",
    });
  }
  return downloadsApiInstance;
}

// Throw on an invalid npm name before any network call. `validForOldPackages`
// is used (not `validForNewPackages`) since we look up packages that already
// exist, some under legacy naming rules.
export function validatePackageName(name: string): void {
  const result = validatePackageNameLib(name);
  if (!result.validForOldPackages) {
    const reason: string = [...(result.errors ?? []), ...(result.warnings ?? [])].join(
      "; ",
    );
    throw new NpmFetchError(
      "invalid_package_name",
      400,
      `Invalid npm package name "${name}": ${reason}`,
    );
  }
}

type PackumentApiResponse = {
  name: string;
  description?: string | null;
  "dist-tags"?: Record<string, string>;
  maintainers?: Array<{ name?: string; email?: string }>;
  license?: string | { type?: string };
  homepage?: string | null;
  repository?: string | { type?: string; url?: string } | null;
  time?: Record<string, string>;
  versions?: Record<string, PackumentVersion>;
};

type PackumentVersion = {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  dist?: {
    tarball?: string;
    integrity?: string;
    shasum?: string;
    unpackedSize?: number;
    fileCount?: number;
    signatures?: unknown;
    attestations?: unknown;
  };
};

function normalizeLicense(
  license: string | { type?: string } | undefined,
): string | null {
  if (license === undefined) {
    return null;
  }
  if (typeof license === "string") {
    return license;
  }
  return license.type ?? null;
}

function normalizeRepository(
  repository: string | { type?: string; url?: string } | null | undefined,
): NpmRepository | null {
  if (repository === undefined || repository === null) {
    return null;
  }
  if (typeof repository === "string") {
    return { type: null, url: repository };
  }
  return { type: repository.type ?? null, url: repository.url ?? null };
}

function normalizeMaintainers(
  maintainers: Array<{ name?: string; email?: string }> | undefined,
): NpmMaintainer[] {
  if (maintainers === undefined) {
    return [];
  }
  return maintainers.map((maintainer): NpmMaintainer => ({
    name: maintainer.name ?? "",
    email: maintainer.email ?? null,
  }));
}

function normalizeTime(time: Record<string, string> | undefined): NpmTime {
  if (time === undefined) {
    return { created: null, modified: null, versions: {} };
  }
  const versions: Record<string, string> = {};
  for (const [key, value] of Object.entries(time)) {
    if (key !== "created" && key !== "modified") {
      versions[key] = value;
    }
  }
  return {
    created: time.created ?? null,
    modified: time.modified ?? null,
    versions,
  };
}

function distillLatest(
  version: PackumentVersion | undefined,
): NpmLatestManifest | null {
  if (version === undefined) {
    return null;
  }
  const dist = version.dist ?? {};
  return {
    version: version.version,
    dependencies: version.dependencies ?? {},
    devDependencies: version.devDependencies ?? {},
    scripts: version.scripts ?? {},
    engines: version.engines ?? null,
    dist: {
      tarball: dist.tarball ?? null,
      integrity: dist.integrity ?? null,
      shasum: dist.shasum ?? null,
      unpackedSize: dist.unpackedSize ?? null,
      fileCount: dist.fileCount ?? null,
      signatures: dist.signatures ?? null,
      attestations: dist.attestations ?? null,
    },
  };
}

type DistilledPackument = {
  packument: NpmPackument;
  latest: NpmLatestManifest | null;
};

async function fetchPackument(name: string): Promise<DistilledPackument> {
  await npmRegistryLimiter.acquire();
  try {
    const res = await registryApi().get<PackumentApiResponse>(
      `/${name}`,
    );
    const raw = res.data;
    const distTagLatest: string | null = raw["dist-tags"]?.latest ?? null;
    const latestManifest: PackumentVersion | undefined =
      distTagLatest !== null ? raw.versions?.[distTagLatest] : undefined;
    return {
      packument: {
        name: raw.name,
        description: raw.description ?? null,
        distTagLatest,
        maintainers: normalizeMaintainers(raw.maintainers),
        license: normalizeLicense(raw.license),
        homepage: raw.homepage ?? null,
        repository: normalizeRepository(raw.repository),
        time: normalizeTime(raw.time),
      },
      latest: distillLatest(latestManifest),
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      throw new NpmFetchError(
        "package_not_found",
        404,
        `Package not found: ${name}`,
      );
    }
    throw error;
  }
}

type DownloadsApiResponse = {
  downloads: number;
};

async function fetchDownloadPoint(
  period: string,
  name: string,
): Promise<number | null> {
  const res = await downloadsApi().get<DownloadsApiResponse>(
    `/downloads/point/${period}/${name}`,
  );
  return res.data.downloads;
}

// Download counts are a non-fatal enrichment: on any failure we return null so
// the caller still caches the packument blob.
async function fetchDownloads(name: string): Promise<NpmDownloads | null> {
  await npmRegistryLimiter.acquire();
  try {
    const lastWeek: number | null = await fetchDownloadPoint("last-week", name);
    await npmRegistryLimiter.acquire();
    const lastMonth: number | null = await fetchDownloadPoint(
      "last-month",
      name,
    );
    return { lastWeek, lastMonth };
  } catch {
    return null;
  }
}

// Read-through fetch: assemble the full cached blob for a package name. On a
// packument failure this throws (the caller must NOT persist a row); download
// failures are swallowed (downloads: null).
export async function fetchNpmPackageData(
  name: string,
): Promise<NpmPackageData> {
  validatePackageName(name);
  const distilled: DistilledPackument = await fetchPackument(name);
  const downloads: NpmDownloads | null = await fetchDownloads(name);
  return {
    schemaVersion: NPM_SCHEMA_VERSION,
    packument: distilled.packument,
    latest: distilled.latest,
    downloads,
  };
}
