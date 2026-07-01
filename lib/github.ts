// SERVER-ONLY GitHub REST client for the GitHub source cache.
//
// All outbound GitHub calls are paced through the shared RateLimiter so we stay
// under GitHub's primary and secondary rate limits. GitHub meters "core" and
// "Search" independently, so we keep two module-level limiters. Only core is
// used today (repo metadata + contents); the search limiter is here for the
// upcoming issue-count signals so all callers share one bucket.
import axios, { AxiosError, type AxiosInstance } from "axios";
import { getGithubToken } from "@/lib/github-token";
import { RateLimiter, systemClock } from "@/lib/rate-limiter";

// Bump when the cached `data` shape changes so stale rows are recognizable.
export const GITHUB_SCHEMA_VERSION: number = 3;

const MS_PER_DAY: number = 1000 * 60 * 60 * 24;

// Per-request timeout on outbound GitHub calls. Without it, a hung upstream
// connection would stall the (sequential) analysis run indefinitely. Failures
// here surface as a fatal run error (source repo) or null enrichment.
const UPSTREAM_TIMEOUT_MS: number = 10000;

// Fields we control, distilled from `GET /repos/{owner}/{repo}`.
export type GithubRepoInfo = {
  full_name: string;
  description: string | null;
  defaultBranch: string;
  stargazers_count: number;
  forks_count: number;
  subscribers_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  license: GithubLicense | null;
  archived: boolean;
  disabled: boolean;
  topics: string[];
};

export type GithubLicense = {
  key: string;
  name: string;
  spdx_id: string | null;
  url: string | null;
};

// The versioned jsonb blob stored in `GithubRepo.data`.
export type GithubRepoData = {
  schemaVersion: number;
  repo: GithubRepoInfo;
  packageJson: Record<string, unknown> | null;
  packageJsonMissing: boolean;
  // Enrichments requiring extra requests; null when the upstream call failed.
  contributorsCount: number | null;
  commitsLast6Months: number | null;
  openIssues: number | null; // GitHub Search: type:issue state:open total_count
  closedIssues: number | null; // GitHub Search: type:issue state:closed total_count
};

// Distinguishes expected upstream conditions (bad url, missing repo) from
// unexpected failures so the route can pick an appropriate status code.
export class GithubFetchError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "GithubFetchError";
    this.code = code;
    this.status = status;
  }
}

const githubCoreLimiter: RateLimiter = new RateLimiter({
  name: "github-core",
  limitPerMinute: 60,
  clock: systemClock,
});

// Reserved for the upcoming GitHub Search-backed signals (issue counts, etc.).
export const githubSearchLimiter: RateLimiter = new RateLimiter({
  name: "github-search",
  limitPerMinute: 24,
  clock: systemClock,
});

// Built lazily on first use so the token is only read at request time, never at
// module-load/build time. Memoized so all requests share one instance.
let githubApiInstance: AxiosInstance | null = null;

function githubApi(): AxiosInstance {
  if (githubApiInstance === null) {
    githubApiInstance = axios.create({
      baseURL: "https://api.github.com",
      timeout: UPSTREAM_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${getGithubToken()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  }
  return githubApiInstance;
}

// Normalize for use as the cache key: force https, lowercase host, drop a
// trailing `.git` and any trailing slash. Throws on unparseable input.
export function normalizeUrl(url: string): string {
  const trimmed: string = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new GithubFetchError("invalid_url", 400, `Not a valid URL: ${url}`);
  }
  const host: string = parsed.hostname.toLowerCase();
  let path: string = parsed.pathname;
  if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  if (path.endsWith(".git")) {
    path = path.slice(0, -".git".length);
  }
  return `https://${host}${path}`;
}

export type OwnerRepo = {
  owner: string;
  repo: string;
};

// Parse owner/repo from a (normalized) GitHub URL. Requires host github.com and
// at least two path segments.
export function parseOwnerRepo(url: string): OwnerRepo {
  const parsed: URL = new URL(url);
  if (parsed.hostname !== "github.com") {
    throw new GithubFetchError(
      "not_github",
      400,
      `Not a github.com URL: ${url}`,
    );
  }
  const segments: string[] = parsed.pathname
    .split("/")
    .filter((segment: string): boolean => segment.length > 0);
  if (segments.length < 2) {
    throw new GithubFetchError(
      "invalid_repo_url",
      400,
      `Could not parse owner/repo from: ${url}`,
    );
  }
  return { owner: segments[0], repo: segments[1] };
}

type GithubRepoApiResponse = {
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  subscribers_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  license: GithubLicense | null;
  archived: boolean;
  disabled: boolean;
  topics: string[] | null;
};

type GithubContentsApiResponse = {
  content: string;
  encoding: string;
};

async function fetchRepoMetadata(input: OwnerRepo): Promise<GithubRepoInfo> {
  await githubCoreLimiter.acquire();
  try {
    const res = await githubApi().get<GithubRepoApiResponse>(
      `/repos/${input.owner}/${input.repo}`,
    );
    const raw = res.data;
    return {
      full_name: raw.full_name,
      description: raw.description,
      defaultBranch: raw.default_branch,
      stargazers_count: raw.stargazers_count,
      forks_count: raw.forks_count,
      subscribers_count: raw.subscribers_count,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      pushed_at: raw.pushed_at,
      license: raw.license,
      archived: raw.archived,
      disabled: raw.disabled,
      topics: raw.topics ?? [],
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      throw new GithubFetchError(
        "repo_not_found",
        404,
        `Repo not found: ${input.owner}/${input.repo}`,
      );
    }
    throw error;
  }
}

// Root package.json, base64-decoded and JSON-parsed. Returns null (not an
// error) when the repo has no root package.json.
async function fetchRootPackageJson(
  input: OwnerRepo,
): Promise<Record<string, unknown> | null> {
  await githubCoreLimiter.acquire();
  try {
    const res = await githubApi().get<GithubContentsApiResponse>(
      `/repos/${input.owner}/${input.repo}/contents/package.json`,
    );
    const decoded: string = Buffer.from(res.data.content, "base64").toString(
      "utf-8",
    );
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

// GitHub paginates counts we care about (contributors, commits) one item per
// page; the total is the `page` number of the `rel="last"` Link. Returns null
// when there is no Link header (caller falls back to the item count).
function parseLastPage(linkHeader: string | undefined): number | null {
  if (linkHeader === undefined) {
    return null;
  }
  const match: RegExpMatchArray | null = linkHeader.match(
    /[?&]page=(\d+)[^>]*>;\s*rel="last"/,
  );
  return match !== null ? Number(match[1]) : null;
}

// Contributor count via `per_page=1` + the `rel="last"` page number. Non-fatal:
// returns null on any failure (e.g. 403 for repos too large to compute).
async function fetchContributorsCount(
  input: OwnerRepo,
): Promise<number | null> {
  await githubCoreLimiter.acquire();
  try {
    const res = await githubApi().get<unknown[]>(
      `/repos/${input.owner}/${input.repo}/contributors`,
      { params: { per_page: 1, anon: "true" } },
    );
    const lastPage: number | null = parseLastPage(
      res.headers.link as string | undefined,
    );
    if (lastPage !== null) {
      return lastPage;
    }
    return Array.isArray(res.data) ? res.data.length : 0;
  } catch {
    return null;
  }
}

// Commit count over the last 6 months (180 days) via `since=` + the
// `rel="last"` page number. An empty repo returns 409; treat that as 0. Other
// failures -> null.
async function fetchCommitsLast6Months(
  input: OwnerRepo,
): Promise<number | null> {
  const since: string = new Date(Date.now() - 180 * MS_PER_DAY).toISOString();
  await githubCoreLimiter.acquire();
  try {
    const res = await githubApi().get<unknown[]>(
      `/repos/${input.owner}/${input.repo}/commits`,
      { params: { since, per_page: 1 } },
    );
    const lastPage: number | null = parseLastPage(
      res.headers.link as string | undefined,
    );
    if (lastPage !== null) {
      return lastPage;
    }
    return Array.isArray(res.data) ? res.data.length : 0;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 409) {
      return 0;
    }
    return null;
  }
}

type SearchIssuesApiResponse = {
  total_count: number;
};

// Issue count for a given state via the Search API (`type:issue` excludes PRs).
// Metered by the separate `github-search` limiter. Non-fatal: null on failure.
async function fetchIssueCount(
  input: OwnerRepo,
  state: string,
): Promise<number | null> {
  await githubSearchLimiter.acquire();
  try {
    const res = await githubApi().get<SearchIssuesApiResponse>(
      `/search/issues`,
      {
        params: {
          q: `repo:${input.owner}/${input.repo} type:issue state:${state}`,
          per_page: 1,
        },
      },
    );
    return res.data.total_count;
  } catch {
    return null;
  }
}

// Read-through fetch: assemble the full cached blob for a normalized repo URL.
// On any upstream failure of the core metadata this throws (the caller must NOT
// persist a row). The enrichment calls below are non-fatal (null on failure).
export async function fetchGithubRepoData(
  normalizedUrl: string,
): Promise<GithubRepoData> {
  const ownerRepo: OwnerRepo = parseOwnerRepo(normalizedUrl);
  const repo: GithubRepoInfo = await fetchRepoMetadata(ownerRepo);
  const packageJson: Record<string, unknown> | null =
    await fetchRootPackageJson(ownerRepo);
  const [contributorsCount, commitsLast6Months, openIssues, closedIssues]: [
    number | null,
    number | null,
    number | null,
    number | null,
  ] = await Promise.all([
    fetchContributorsCount(ownerRepo),
    fetchCommitsLast6Months(ownerRepo),
    fetchIssueCount(ownerRepo, "open"),
    fetchIssueCount(ownerRepo, "closed"),
  ]);
  return {
    schemaVersion: GITHUB_SCHEMA_VERSION,
    repo,
    packageJson,
    packageJsonMissing: packageJson === null,
    contributorsCount,
    commitsLast6Months,
    openIssues,
    closedIssues,
  };
}
