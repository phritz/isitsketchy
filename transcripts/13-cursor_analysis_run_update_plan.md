# Analysis run update plan
_Exported on 7/1/2026 at 16:00:43 CDT from Cursor (3.9.16)_

---

**User**

lets update @plan/analysis.md 
- call analysis an analysisrun
- have an analysisrun be an association object for analysisresults. the status goes on the results and the status of the analysisrun is the aggregate of its results. 
- we create analsysresults in pending state at the start of the analysis
- the individual steps update teh appropriate analysisresult. the result has a name and a risk score (red, yellow, green) and a comment. careful to make the risk scores compatible with typescript and postgres types, pick the dead simplest wya to do it, maybe just strings that are constnats in the code.
do not use any fancing task scheduling. the analysis endpoint creates the records and just runs them synchronously. sequential is fine for now.
- plan is when a url is submitted on home page navigate to /ui/analysis/$id and that page polls and shows results. keep it simple for now we will make it purty later
- show each analysisresult for the analysis in the page
- also have a page for listing all analyses so we can browse them (click through loads /ui/analysis/$id)

anything more to discuss? recall we are just fleshing out the plan.

---

**Cursor**

I'll research the current plan and codebase structure before updating the plan.

Let me look at the actual codebase structure to ground the plan.

Before I flesh out the plan, I have two modeling questions that significantly change the shape of `plan/analysis.md`.

One tension I noticed: [plan/project.md](plan/project.md) says the tool analyzes **each of the repo's npm dependencies**, but the current [plan/analysis.md](plan/analysis.md) is written around a **single package** (the repo's own `package.json`) producing a list of signals. The "AnalysisResult with a name, risk score, and comment" model could map to either interpretation, so I want to pin it down.

> **What does a single AnalysisResult represent (its 'name' + risk score + comment)?**
> - One result per npm dependency (Recommended - matches project.md's 'analyze each dependency' vision; name = package name, risk = rolled-up risk, comment = summary). Results created pending after reading the repo's package.json.
> - One result per signal/check (matches the current analysis.md; name = signal label like 'Install hooks', risk = that signal's assessment) for a single target package. ✔
> - One result per pipeline step (e.g. 'Resolve repo', 'Fetch npm', 'Compute signals').

> **How should risk score and status be stored (TS + Postgres)?**
> - Plain String columns + TS string-literal union constants in code (Recommended - dead simplest, no Prisma enum, no enum in db:push). ✔
> - Prisma enums (RiskScore, ResultStatus) generating Postgres enum types.

Got it — per-signal results for a single target package, plain string columns with TS union constants. Let me quickly check the middleware and current home page so the plan references them accurately.

This is a plan-doc edit and we're in plan mode (markdown edits are allowed while refining the plan), so I'll rewrite `plan/analysis.md` directly to reflect your decisions.

Updated [plan/analysis.md](plan/analysis.md) with the `AnalysisRun` + `AnalysisResult` (per-signal) association model, string-constant risk/status values, synchronous sequential execution, and the two UI pages.

A few decisions I made where your instructions left a small gap (easy to flip):

- **Run status is derived, not stored.** You said "the status of the analysisrun is the aggregate of its results," so I made it a `deriveRunStatus(results)` helper instead of a column, to avoid drift. Tradeoff: the list page includes each run's results' `status` to compute it. Denormalizing into a column later is trivial if the list query gets heavy.
- **POST runs the full pipeline synchronously and returns the id after it finishes.** That's the literal "runs them synchronously" reading. Consequence: the poll page will usually load already-completed, so you won't *see* live pending→running→completed transitions yet. The states still exist in the DB and the poll code is future-proof; making it truly progressive later is a one-line change (don't `await`). If you'd rather see live progress now, I'd instead have POST kick off the run detached and return the id immediately.
- **Prerequisites (resolve repo / read package.json / resolve npm) are not signals.** They're a setup phase; if they fail, `run.error` is set and all pending results are marked `failed`. Only the checks from `signals.md` become `AnalysisResult` rows.
- **Per-signal failures are isolated** via a `safeRunSignal` helper so one bad signal doesn't kill the rest. This is one small `try/catch` living in the orchestration lib (`lib/analysis/`), which stays consistent with AGENTS.md's "one top-level try/catch per handler" (the handler itself keeps its single top-level one).

A couple of things worth flagging for discussion:

1. **Tension with `project.md`.** `project.md` describes analyzing *each of the repo's dependencies*, but you chose per-signal results for a *single target package* (matching the current analysis.md framing). So this doc now analyzes the repo's own package, not its dependency graph. Want me to (a) leave that broader deps vision in `project.md` as a later phase, or (b) reconcile the docs so it's clear the current MVP is single-package?
2. **`signalId` slug + `order`** — I added a stable `signalId` and an `order` column so results have deterministic identity/ordering. Fine, or overkill for now?

---

**User**

- why do we need repourl? we just use /ui/analysis/$id
- why do we need order?
- we will need to differentiate between signals derived from the repo vs from the dependent packages. we could introduce a layer AnalysisSubject which is either a package or a repo, and hang results off of that, but that is more complexity and we are trying to keep this simple. the goal is to show in the ui which package or repo the result is associated with, maybe we can just embed the type (repo vs package) and id/name in the analysis result?
- we need to create analysisresults for all the signals before running them, does the api support that (i think via signaldefs?)
- when we trigger an analysis it should POST the analysis which creates the analysisrun and then returns its id, the ui then navs to that page which polls for status. the POST handler should handle running the analysis after returning. is that an antipattern? if so can we detatch that work from the handler? or do a two step thing where we create the analysis, navigate and then trigger the analysis to start on hte analysis page? opinion?

---

**Cursor**

Good questions. Let me address each, then update the plan.

1. **`repoUrl`** — keep it. It's not for routing (that's `id`); it's the analysis *input/subject*. We need it to actually run the analysis, and to display "what was analyzed" on both the detail header and the browse list. I'll clarify that in the doc.
2. **`order`** — agreed, drop it. Results are created from the `SIGNALS` registry, so the UI can just render them in registry order (or fall back to `createdAt`). No column needed.
3. **repo vs package** — agreed, skip the `AnalysisSubject` layer. Embed `subjectType` (`"repo" | "package"`) + `subjectName` on `AnalysisResult`. `subjectType` comes from the `SignalDef` and is known at creation; `subjectName` (e.g. `expressjs/express` or `express`) isn't fully known until we resolve the repo/package, so I'll make it nullable and fill it when the signal runs.
4. **create-all-then-run** — yes. The `SIGNALS` registry (signaldefs) is the source of truth; we `createMany` one pending result per entry up front, then iterate. Confirmed supported.
5. **POST-then-run** — not really an antipattern *here*, because we're on a persistent Railway Node process (not serverless), so the process stays alive to finish. My recommendation: **detach the work from the handler** rather than the two-step client-trigger. Create + return `id`, then run the orchestration after the response via `after()` from `next/server` (the sanctioned API for post-response work) or a fire-and-forget `void runAnalysis(id).catch(log)`. The two-step approach adds a second endpoint plus start/double-start guards for no MVP benefit; its only real edge (surviving a mid-run restart) is better handled later by a "resume" sweep that re-runs results stuck in `pending`/`running`.

Let me apply these to the doc.

Now the endpoints and execution sections.

Now update the client types list to include `SubjectType`.

All five points are now reflected in [plan/analysis.md](plan/analysis.md). Summary of what changed:

- **`repoUrl`** — kept, with a clarifying note that it's the analysis input/subject shown in the UI, not routing (id handles that).
- **`order`** — removed; UI renders results in `SIGNALS` registry order.
- **repo vs package** — added `subjectType` (`"repo" | "package"`, with a `SUBJECT_TYPES` constant) + nullable `subjectName` on `AnalysisResult`; `SignalDef` now declares `subject`. No `AnalysisSubject` layer. `subjectName` is populated when the signal runs (repo `full_name` / resolved package name).
- **create-all-then-run** — spelled out: POST `createMany`s one pending result per `SIGNALS` entry (copying `signalId`/`name`/`subjectType`) before any work runs.
- **POST-then-run** — reworked the Execution section to "detached, sequential": create + return `id`, run orchestration after the response via `after()` (preferred) or fire-and-forget, with the two-step alternative explicitly rejected and a restart caveat + future resume-sweep noted. Flow diagram and steps updated to return the id before the detached work.

One remaining open item from last round still worth a decision: the `project.md` "analyze each dependency" vision vs this doc's single-package MVP. Want me to add a short "Scope: single package for now, dependency graph later" note to reconcile them, or leave it?

---

**User**

we are going to analysze the source repo and all its direct dependency packages

---

**Cursor**

This meaningfully expands the model, so I want to lock down one structural decision before rewriting the plan.

With the new scope, an `AnalysisRun` now has **many subjects**: the source repo plus each direct dependency. And per [plan/project.md](plan/project.md) step 2, each dependency yields **both** package signals (npm registry/downloads/deps.dev) **and** repo signals (via its own `repository.url` → GitHub). So results become a subject × signal matrix (e.g. ~30 deps × ~13 signals ≈ hundreds of results per run).

Two consequences:
- Dependencies aren't known until we fetch the source repo's `package.json`, so we can no longer create all pending results at POST time — the detached worker must first enumerate subjects, then create the pending rows.
- We now need to **group** results by subject in the UI (a dependency's package signals and its repo signals belong together), which is exactly the grouping the `AnalysisSubject` layer would provide.

Given that, how do you want to model subjects?

> **How should we model the many subjects (source repo + each dependency) now that each dependency has both package and repo signals?**
> - Add an AnalysisSubject layer: AnalysisRun -> AnalysisSubject (kind: source_repo | dependency; holds package name + resolved repo) -> AnalysisResult (Recommended - clean grouping, per-subject status, natural fit now that scale/grouping justify the layer we earlier deferred). ✔
> - Keep AnalysisResult flat; add grouping fields on each result (e.g. groupKey = 'source' or dependency name, plus subjectType repo|package + subjectName). Simplest schema, some denormalization, UI groups by key.

> **Does the source repo also get package (npm) signals, or repo signals only?**
> - Source repo gets repo signals only; only dependencies get package signals (Recommended - the source project isn't necessarily published to npm).
> - Also run package signals on the source repo when its package.json name resolves on npm.
>
> Answer: we will run package signals on the source repo if we have a link to its package but its ok if we do not; i do think we might not need to distinguish source vs dependency repo, aren't they all just repos?

Great — that clarifies it. Subjects are uniform: every subject is just a **repo or a package** (no source-vs-dependency distinction), and we run package signals on the source repo too if we can link it to a package. This also means repo subjects can be deduped by URL, so a monorepo backing many packages gets analyzed once. Let me rewrite the plan around `AnalysisRun` → `AnalysisSubject` (repo | package) → `AnalysisResult`.

Rewrote [plan/analysis.md](plan/analysis.md) around the three-level model. Key points:

- **`AnalysisRun` → `AnalysisSubject` (repo | package) → `AnalysisResult`.** Subjects are uniform repos/packages with no source-vs-dependency distinction; `type` reuses the `SubjectType` constant. Results drop their subject fields (inherited from the subject) and stay lean.
- **Scope section** spells out: source repo → repo signals (+ package signals if its `package.json` name resolves on npm), each direct dependency → package signals + repo signals via its `repository.url`.
- **Repo subject dedup** via `@@unique([analysisRunId, type, name])` so a monorepo backing many packages is analyzed once.
- **Two split signal registries** (`REPO_SIGNALS`, `PACKAGE_SIGNALS`) with typed contexts; each subject creates one pending result per applicable entry.
- **Two-phase detached worker**: Phase 1 discovers subjects (source repo → deps → each dep's package + linked repo) and creates all pending rows; Phase 2 computes sequentially. Results can't be created at POST time anymore since deps are discovered dynamically — the doc calls this out.
- **Errors** now have three levels: fatal `run.error` (source repo unresolvable), per-subject `subject.error` (a bad dependency doesn't stop the rest), and per-signal failed results.
- **`deriveStatus`** now aggregates at both subject and run level.

One consistency note: [plan/project.md](plan/project.md) line 7 still says the analysis runs on dependencies *"not the repo itself"*, which now contradicts analyzing the source repo. Want me to update `project.md` to match (source repo + direct dependencies), or leave it?

---

**User**

yes update it and then propose the first signal that we should implement. it should be repo only because we are still working on the package code.

---

**Cursor**

Updating [plan/project.md](plan/project.md) to match, then I'll propose the first signal.

Done — `project.md` now reflects analyzing the source repo plus its direct dependencies.

## Proposed first signal: Last-push recency (`repo` only)

This is the best first signal to build end-to-end: it's repo-only (no package code needed yet), needs **zero new fetching** (the field is already in the cached GitHub blob), and it naturally exercises all three risk levels.

- **`signalId`**: `repo_last_push`
- **`name`**: `Last push recency`
- **Registry**: goes in `REPO_SIGNALS` in `lib/analysis/signals.ts`
- **Input**: `ctx.repo.pushed_at` — already present in the github source cached shape (`data.repo.pushed_at`, per [plan/sources-github.md](plan/sources-github.md))
- **Logic** (age = `now - pushed_at`):
  - `green` — pushed within the last 12 months
  - `yellow` — 12–24 months
  - `red` — older than 24 months (looks abandoned)
- **`comment`**: e.g. `Last push 3 months ago (2026-04-02)`

Sketch of the def:

```ts
export const REPO_SIGNALS: SignalDef<RepoSignalContext>[] = [
  {
    id: "repo_last_push",
    name: "Last push recency",
    compute: ({ repo }) => {
      const pushedAt = new Date(repo.pushed_at);
      const months = (Date.now() - pushedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const riskScore: RiskScore = months <= 12 ? "green" : months <= 24 ? "yellow" : "red";
      return { riskScore, comment: `Last push ${Math.floor(months)} months ago (${repo.pushed_at.slice(0, 10)})` };
    },
  },
];
```

Why this one over alternatives:
- `repo_archived` (archived/disabled) is essentially binary (red/green), so it doesn't show the yellow path.
- `repo_age`, `stars`, `license_present` are also fine and equally cheap, but "staleness" is the single most intuitive repo sketchiness signal and gives a clean 3-level mapping.

Want me to also fold this concrete first-signal choice into [plan/analysis.md](plan/analysis.md) (e.g. mark `repo_last_push` as the MVP starting point), or leave the plan's candidate list as-is? And are the 12/24-month thresholds good, or would you prefer different cutoffs?

---

**User**

great but lets have green be pushed within the last month, yellow be in last 2-6 months and red be anything older. yes add it to the plan. also add to deferred work doc that we should make these parameters configurable from the web but we are not doing that now

---

**Cursor**

Adding the first signal to the plan and a deferred entry for configurable parameters.

Done. Changes made:

- [plan/analysis.md](plan/analysis.md) — added a **First signal to implement: `repo_last_push`** subsection with your thresholds (`green` ≤ 1 month, `yellow` 1–6 months, `red` older than 6 months) and the compute sketch. Note: the 1–2 month range falls into `yellow` since `green` is strictly "within the last month."
- [plan/deferred.md](plan/deferred.md) — added a **Configurable signal parameters** entry noting thresholds/weights should become web-configurable later, but not now.
- [plan/project.md](plan/project.md) — (prior step) now reflects analyzing the source repo plus direct dependencies.

One small heads-up: the existing "Multiple packages / repos per run" entry in `deferred.md` still refers to the old `AnalysisRun -> AnalysisResult` model and "we'd add a subject grouping" — that grouping (`AnalysisSubject`) now exists. Want me to tweak that entry for consistency, or leave it?

---

**User**

yes update it

---

**Cursor**

Updated the "Multiple packages / repos per run" entry in [plan/deferred.md](plan/deferred.md) to reflect the `AnalysisRun -> AnalysisSubject -> AnalysisResult` model (subject grouping now exists, so the "later" work is mainly comparison UI).

The plan docs are now consistent across `project.md`, `analysis.md`, and `deferred.md`. Let me know if you'd like to start implementing `repo_last_push` (which would mean switching out of plan mode).

