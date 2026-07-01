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
      const riskScore: RiskScore =
        months <= 1 ? "green" : months <= 6 ? "yellow" : "red";
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
      const riskScore: RiskScore =
        count >= 10 ? "green" : count >= 2 ? "yellow" : "red";
      return {
        riskScore,
        comment: `${count.toLocaleString()} contributor${
          count === 1 ? "" : "s"
        }`,
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
      const riskScore: RiskScore =
        count >= 5 ? "green" : count >= 1 ? "yellow" : "red";
      return {
        riskScore,
        comment: `${count.toLocaleString()} commit${
          count === 1 ? "" : "s"
        } in the last 6 months`,
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
      const riskScore: RiskScore =
        ratio >= 2 ? "green" : ratio >= 0.5 ? "yellow" : "red";
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
      const riskScore: RiskScore =
        months >= 12 ? "green" : months >= 3 ? "yellow" : "red";
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
      const riskScore: RiskScore =
        stars >= 500 ? "green" : stars >= 50 ? "yellow" : "red";
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
      const riskScore: RiskScore =
        months >= 12 ? "green" : months >= 3 ? "yellow" : "red";
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
      const riskScore: RiskScore =
        months <= 6 ? "green" : months <= 18 ? "yellow" : "red";
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
      const riskScore: RiskScore =
        count >= 2 ? "green" : count === 1 ? "yellow" : "red";
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
      const riskScore: RiskScore =
        lastMonth >= 100000 ? "green" : lastMonth >= 1000 ? "yellow" : "red";
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
      if (npmPackage.packument.anyVersionDeprecated) {
        return {
          riskScore: "yellow",
          comment: "An older version is deprecated, but the latest is not",
        };
      }
      return {
        riskScore: "green",
        comment: "Not deprecated",
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
      const riskScore: RiskScore =
        count >= 100 ? "green" : count >= 10 ? "yellow" : "red";
      return {
        riskScore,
        comment: `${count.toLocaleString()} direct dependents (deps.dev)`,
      };
    },
  },
];
