# Deferred Work

Things we've deliberately punted on to keep the MVP small. Each entry notes *what* we're deferring, *why it's fine for now*, and a *sketch of how* we'd do it later. Part of the [high-level plan](project.md).

## Recursively crawling subpackages

- **Now:** we analyze only the direct dependencies declared in the target repo's root `package.json` (see [analysis.md](analysis.md)). Transitive/nested deps are not walked.
- **Why fine:** direct deps are the highest-signal, lowest-noise set and keep the run bounded and fast.
- **Later:** walk the dependency tree (via a lockfile for exact resolved versions, or by recursively fetching each dep's npm metadata). Needs cycle detection, a depth/count cap, and dedup so a package shared across the tree is analyzed once. Ties into the parallelism work below since the fan-out grows quickly.

## Multiple packages / repos per run

- **Now:** a run takes exactly one input — one GitHub repo URL (`CreateAnalysisRequest { repoUrl }`) — which fans out into many subjects (the source repo + each direct dependency's package and repo).
- **Why fine:** one-in / one-run keeps the model, orchestration, and UI simple.
- **Later:** accept a list of repos and/or packages per run (or a batch endpoint). The `AnalysisRun` -> `AnalysisSubject` -> `AnalysisResult` model already groups results by subject, so multiple inputs stay attributable; we'd mainly add UI to compare them.

## Parallelism and a background worker

- **Now:** signals run **sequentially, in-process, detached after the response** on the persistent Railway Node process (see "Execution" in [analysis.md](analysis.md)). No queue, no scheduler.
- **Why fine:** for a single repo's direct deps the total work is small; sequential is simple and observable.
- **Later:** run independent signals/dependencies concurrently (bounded concurrency), and move orchestration to a real background worker/queue so runs survive process restarts. Pairs with an idempotent resume sweep that re-runs any results stuck in `pending`/`running`.

## Finding the npm package from a repo or the web

- **Now:** we resolve the target npm package from the repo's root `package.json` name (and each dependency is already an npm name). No fuzzy/repo-to-package or web lookup.
- **Why fine:** the root `package.json` gives us the identity directly for the supported entrypoint.
- **Later:** support repos without a usable root `package.json`, monorepos with many publishable packages, and a package-name-first / web-search entrypoint that maps a repo or freeform query to the right npm package(s).

## Configurable signal parameters

- **Now:** signal thresholds/parameters are hardcoded constants in the signal defs (e.g. `repo_last_push`'s 1-month / 6-month cutoffs in [analysis.md](analysis.md)). Changing them requires a code edit + redeploy.
- **Why fine:** sensible fixed defaults are enough to ship the first signals; we do not need tuning to prove the pipeline.
- **Later:** make thresholds (and per-signal weights) editable from the web UI, persisted (per-run snapshot or global config) so runs are reproducible. Not doing this now.

## Cache TTL

- **Now:** the github/npm source blobs are cached read-through with no expiry/invalidation (see [sources-github.md](sources-github.md) / [sources-npm.md](sources-npm.md)); a cached blob is reused indefinitely.
- **Why fine:** upstream metadata changes slowly and stale-but-present beats rate-limit failures for the MVP.
- **Later:** add a TTL (and/or explicit refresh) so blobs past their age are re-fetched, with a "last fetched" timestamp surfaced in the UI. Consider per-source TTLs (downloads change faster than repo creation date).
