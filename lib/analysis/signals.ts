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

export const REPO_SIGNALS: SignalDef<RepoSignalContext>[] = [
  {
    id: "repo_last_push",
    name: "Last push recency",
    compute: ({ repo }: RepoSignalContext): SignalOutcome => {
      const pushedAt: string | null = repo.repo.pushed_at;
      if (pushedAt === null) {
        throw new Error("Repo has no pushed_at timestamp");
      }
      const months: number =
        (Date.now() - new Date(pushedAt).getTime()) / MS_PER_MONTH;
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
];

export const PACKAGE_SIGNALS: SignalDef<PackageSignalContext>[] = [];
