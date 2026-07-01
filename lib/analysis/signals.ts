// Signal registries, keyed by data source. A `repo` subject creates one pending
// result per REPO_SIGNALS entry; a `package` subject one per PACKAGE_SIGNALS
// entry. Each `compute` is pure over an already-cached source blob. Thresholds
// are hardcoded for now (see plan/deferred.md).
import type { GithubRepoData } from "@/lib/github";
import type { NpmPackageData } from "@/lib/npm";
import type { RiskScore } from "@/app/api/analysis/client";

export type RepoSignalContext = { repo: GithubRepoData };
export type PackageSignalContext = { npmPackage: NpmPackageData };

export type SignalOutcome = {
  riskScore: RiskScore;
  comment: string;
};

export type SignalDef<Ctx> = {
  id: string;
  name: string;
  compute: (ctx: Ctx) => SignalOutcome;
};

const MS_PER_MONTH: number = 1000 * 60 * 60 * 24 * 30;

function monthsSince(isoTimestamp: string): number {
  return (Date.now() - new Date(isoTimestamp).getTime()) / MS_PER_MONTH;
}

// Three-band scoring for a metric where a higher value is healthier: green at
// or above `greenAt`, yellow at or above `yellowAt`, otherwise red.
function scoreHighGood(
  value: number,
  greenAt: number,
  yellowAt: number,
): RiskScore {
  return value >= greenAt ? "green" : value >= yellowAt ? "yellow" : "red";
}

// Three-band scoring for a metric where a lower value is healthier (e.g. months
// since last activity): green at or below `greenAt`, yellow at or below
// `yellowAt`, otherwise red.
function scoreLowGood(
  value: number,
  greenAt: number,
  yellowAt: number,
): RiskScore {
  return value <= greenAt ? "green" : value <= yellowAt ? "yellow" : "red";
}

// `<count> <noun>` with the noun pluralized unless the count is exactly one.
function pluralize(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

export const REPO_SIGNALS: SignalDef<RepoSignalContext>[] = [
  {
    id: "repo_last_push",
    name: "Last push recency",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      const pushedAt: string | null = repo.repo.pushed_at;
      if (pushedAt === null) {
        throw new Error("Repo has no pushed_at timestamp");
      }
      const months: number = monthsSince(pushedAt);
      const riskScore: RiskScore = scoreLowGood(months, 1, 6);
      return {
        riskScore,
        comment: `Last push ${Math.floor(months)} months ago (${pushedAt.slice(
          0,
          10,
        )})`,
      };
    },
  },
  {
    id: "repo_contributors",
    name: "Contributor count",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      const count: number | null = repo.contributorsCount;
      if (count === null) {
        throw new Error("Contributor count unavailable");
      }
      const riskScore: RiskScore = scoreHighGood(count, 10, 2);
      return {
        riskScore,
        comment: pluralize(count, "contributor"),
      };
    },
  },
  {
    id: "repo_commits_last_6_months",
    name: "Recent commit volume",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      const count: number | null = repo.commitsLast6Months;
      if (count === null) {
        throw new Error("Commit count unavailable");
      }
      const riskScore: RiskScore = scoreHighGood(count, 5, 1);
      return {
        riskScore,
        comment: `${pluralize(count, "commit")} in the last 6 months`,
      };
    },
  },
  {
    id: "repo_issue_responsiveness",
    name: "Issue responsiveness",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      const open: number | null = repo.openIssues;
      const closed: number | null = repo.closedIssues;
      if (open === null || closed === null) {
        throw new Error("Issue counts unavailable");
      }
      if (open === 0) {
        return {
          riskScore: "green",
          comment: `No open issues (${closed.toLocaleString()} closed)`,
        };
      }
      const ratio: number = closed / open;
      const riskScore: RiskScore = scoreHighGood(ratio, 2, 0.5);
      return {
        riskScore,
        comment: `${open.toLocaleString()} open / ${closed.toLocaleString()} closed issues (closed:open ${ratio.toFixed(
          1,
        )})`,
      };
    },
  },
  {
    id: "repo_age",
    name: "Repo age",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      const createdAt: string = repo.repo.created_at;
      const months: number = monthsSince(createdAt);
      const riskScore: RiskScore = scoreHighGood(months, 12, 3);
      return {
        riskScore,
        comment: `Repo created ${Math.floor(
          months,
        )} months ago (${createdAt.slice(0, 10)})`,
      };
    },
  },
  {
    id: "repo_stars",
    name: "GitHub stars",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      const stars: number = repo.repo.stargazers_count;
      const riskScore: RiskScore = scoreHighGood(stars, 500, 50);
      return {
        riskScore,
        comment: `${stars.toLocaleString()} stars`,
      };
    },
  },
  {
    id: "repo_archived",
    name: "Archived / disabled",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      if (repo.repo.disabled) {
        return {
          riskScore: "red",
          comment: "Repo is disabled by GitHub",
        };
      }
      if (repo.repo.archived) {
        return {
          riskScore: "yellow",
          comment: "Repo is archived (read-only, unmaintained)",
        };
      }
      return {
        riskScore: "green",
        comment: "Repo is active (not archived or disabled)",
      };
    },
  },
  {
    id: "repo_license",
    name: "License present",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      const license = repo.repo.license;
      if (license === null) {
        return {
          riskScore: "red",
          comment: "No license detected",
        };
      }
      return {
        riskScore: "green",
        comment: `Licensed under ${license.spdx_id ?? license.name}`,
      };
    },
  },
];

export const PACKAGE_SIGNALS: SignalDef<PackageSignalContext>[] = [
  {
    id: "package_age",
    name: "npm package age",
    compute: ({ npmPackage }: PackageSignalContext): SignalOutcome => {
      const created: string | null = npmPackage.packument.time.created;
      if (created === null) {
        throw new Error("Package has no created timestamp");
      }
      const months: number = monthsSince(created);
      const riskScore: RiskScore = scoreHighGood(months, 12, 3);
      return {
        riskScore,
        comment: `Package first published ${Math.floor(
          months,
        )} months ago (${created.slice(0, 10)})`,
      };
    },
  },
  {
    id: "package_latest_publish",
    name: "Latest publish recency",
    compute: ({ npmPackage }: PackageSignalContext): SignalOutcome => {
      const { time, distTagLatest } = npmPackage.packument;
      const publishedAt: string | null =
        (distTagLatest !== null ? time.versions[distTagLatest] : undefined) ??
        time.modified;
      if (publishedAt === null || publishedAt === undefined) {
        throw new Error("Package has no latest publish timestamp");
      }
      const months: number = monthsSince(publishedAt);
      const riskScore: RiskScore = scoreLowGood(months, 6, 18);
      return {
        riskScore,
        comment: `Latest version${
          distTagLatest !== null ? ` (${distTagLatest})` : ""
        } published ${Math.floor(months)} months ago (${publishedAt.slice(
          0,
          10,
        )})`,
      };
    },
  },
  {
    id: "package_maintainers",
    name: "Maintainer count",
    compute: ({ npmPackage }: PackageSignalContext): SignalOutcome => {
      const count: number = npmPackage.packument.maintainers.length;
      const riskScore: RiskScore = scoreHighGood(count, 2, 1);
      const comment: string =
        count === 0
          ? "No maintainers listed on npm"
          : count === 1
            ? "Single maintainer (single point of control)"
            : `${count} maintainers`;
      return { riskScore, comment };
    },
  },
  {
    id: "package_install_hooks",
    name: "Install hooks",
    compute: ({ npmPackage }: PackageSignalContext): SignalOutcome => {
      const latest = npmPackage.latest;
      if (latest === null) {
        throw new Error("Package has no latest manifest");
      }
      const scripts: Record<string, string> = latest.scripts;
      const hooks: string[] = [];
      if (typeof scripts.preinstall === "string") {
        hooks.push("preinstall");
      }
      if (typeof scripts.install === "string") {
        hooks.push("install");
      }
      if (typeof scripts.postinstall === "string") {
        hooks.push("postinstall");
      }
      if (hooks.length > 0) {
        return {
          riskScore: "red",
          comment: `Runs ${hooks.join(" + ")} script${
            hooks.length > 1 ? "s" : ""
          } on install`,
        };
      }
      return {
        riskScore: "green",
        comment: "No install lifecycle scripts",
      };
    },
  },
  {
    id: "package_downloads",
    name: "Monthly downloads",
    compute: ({ npmPackage }: PackageSignalContext): SignalOutcome => {
      const lastMonth: number | null | undefined =
        npmPackage.downloads?.lastMonth;
      if (lastMonth === null || lastMonth === undefined) {
        throw new Error("Download counts unavailable");
      }
      const riskScore: RiskScore = scoreHighGood(lastMonth, 100000, 1000);
      return {
        riskScore,
        comment: `${lastMonth.toLocaleString()} downloads in the last month`,
      };
    },
  },
  {
    id: "package_transparent_build",
    name: "Transparent build",
    compute: ({ npmPackage }: PackageSignalContext): SignalOutcome => {
      const latest = npmPackage.latest;
      if (latest === null) {
        throw new Error("Package has no latest manifest");
      }
      const { attestations, signatures } = latest.dist;
      const hasProvenance: boolean =
        attestations !== null && attestations !== undefined;
      const hasSignatures: boolean =
        signatures !== null &&
        signatures !== undefined &&
        (!Array.isArray(signatures) || signatures.length > 0);
      if (hasProvenance) {
        return {
          riskScore: "green",
          comment: "Published with provenance (build tied to public CI)",
        };
      }
      if (hasSignatures) {
        return {
          riskScore: "yellow",
          comment: "Registry-signed but no provenance (build not verifiable)",
        };
      }
      return {
        riskScore: "red",
        comment: "No signatures or provenance",
      };
    },
  },
  {
    id: "package_deprecated",
    name: "Deprecation",
    compute: ({ npmPackage }: PackageSignalContext): SignalOutcome => {
      const latestDeprecated: string | null =
        npmPackage.latest?.deprecated ?? null;
      if (latestDeprecated !== null) {
        return {
          riskScore: "red",
          comment: `Latest version is deprecated: ${latestDeprecated}`,
        };
      }
      return {
        riskScore: "green",
        comment: "Latest version is not deprecated",
      };
    },
  },
  {
    id: "package_dependents",
    name: "Incoming dependents",
    compute: ({ npmPackage }: PackageSignalContext): SignalOutcome => {
      const count: number | null =
        npmPackage.dependents?.directDependentCount ?? null;
      if (count === null) {
        throw new Error("Dependent count unavailable");
      }
      const riskScore: RiskScore = scoreHighGood(count, 100, 10);
      return {
        riskScore,
        comment: `${count.toLocaleString()} direct dependents (deps.dev)`,
      };
    },
  },
];
