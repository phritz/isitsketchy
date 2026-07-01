# Analysis implementation plan
_Exported on 7/1/2026 at 16:01:03 CDT from Cursor (3.9.16)_

---

**User**

ok lets implement all the machinery required to do the analysis and drive that by implementing the first signal. plan is here: @plan/analysis.md . any questions?

---

**Cursor**

Let me read the plan and related files to understand the task.

Let me examine the existing source infrastructure and related code.

Let me explore the current state of the codebase to understand what exists.

Let me read the existing source implementations to understand the patterns I should follow.

Now let me read the npm source files and the client infrastructure.

Let me read the UI files and remaining infrastructure.

Let me read the remaining infrastructure files.

Let me check the public home page and the github UI page for patterns.

I've now got a thorough understanding of the codebase and the plan. Two things are genuinely ambiguous and would materially change what I build, so let me confirm before writing the plan.

> **The plan says to repurpose the home submit to create an analysis and redirect to /ui/analysis/{id}. Today the /ui home has two demo boxes (GitHub + npm) that just fetch-and-dump JSON to test the source caches. What should happen to them?**
> - Replace the demo boxes with a single 'analyze a repo' form (keep the cache-management links to /ui/sources/*) (Recommended)
> - Keep both demo boxes and add the analysis form as a new primary section above them
> - Repurpose only the GitHub box into the analysis form; keep the npm demo box
>
> Answer: repurpose the github box only for now, and be sure the two direct buttons above work as well, it will no longer just fetch it should trigger analysis

> **The first signal (repo_last_push) is repo-only, so PACKAGE_SIGNALS starts empty. During discovery the worker will still create package subjects for each direct dependency (resolving them via the npm source and linking their repos). Those package subjects would have zero results. How should the first milestone handle them?**
> - Still create package subjects (exercises full dep enumeration + npm/repo resolution) and render them as 'No signals yet' (Recommended) ✔
> - Skip creating package subjects entirely until a package signal exists (repo-subjects-only run for now)

Both decisions are clear. Writing the plan.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll start implementing. Let me mark the first todo in progress and update the Prisma schema.

Now run db:push to apply the schema and regenerate the client.

Let me regenerate the Prisma client to ensure the new models are available.

The models generated correctly (they're gitignored so Glob hides them). Schema done. Moving to the GitHub server client.

Now update the GitHub client to export `ENDPOINT` and `toError`, then add the server client. First the `ENDPOINT` const:

Now the analysis client entrypoint with constants, deriveStatus, types, and browser functions.

Now let me check the api-client.browser to confirm the axios instance shape before proceeding.

Now the signal registry. Let me create `lib/analysis/signals.ts`.

Now the orchestrator — the core detached worker.

Now the route handler.

Now the UI. First repurpose the GitHub box to trigger analysis and redirect.

Now the detail and list pages.

Now add a nav link to the analyses list from the home page.

The file differs from what I read earlier. Let me re-read it.

Now the verify step: lint and build.

Lint passes. Now the build.

Build passes with all routes present. Let me smoke-test end-to-end. First check the env for the token and base URL.

Let me start the server and smoke-test the flow.

Port 3000 is already in use—there's already a server running. Let me use it directly for the smoke test.

The running server on port 3000 is stale (started before the Prisma client was regenerated). Let me find and restart it.

Multiple dev servers are running (the user's), with a stale cached Prisma singleton predating the new models. Rather than disturb them, I'll run the freshly-built server on its own port with a matching base URL for the smoke test.

Server is up. Now create an analysis run.

Run created. Let me wait for the detached orchestration then fetch the run.

Run completed with the `repo_last_push` signal green. But only the repo subject appeared—no package subjects for dependencies. Let me check whether the cached GitHub blob has the root `package.json`.

That repo's cached blob has no root `package.json` (not pushed to its default branch), so no deps to enumerate—that's data, not a bug. Let me test dependency discovery with a repo that definitely has dependencies.

Discovery works correctly: 28 subjects with per-dependency package subjects (repoUrl captured from the packument) and deduped repo subjects (e.g. DefinitelyTyped and typescript-eslint each appear once despite two packages pointing at them). It's still working through the rate-limited fetches. Let me wait and re-poll.

The full pipeline works end-to-end. The run completed with 24 deduped repo subjects and 27 package subjects, and `repo_last_push` exercised all three risk levels: green (recently pushed), yellow (`json-schema-to-ts`, `swc/pkgs` at 1-4 months), and red (`deep-object-diff` 28mo, `ts-node` 23mo, `tsc-multi` 28mo). Package subjects correctly show empty results and don't block run completion.

Let me stop the smoke-test server I started.

Smoke-test server stopped. All todos are complete.

All to-dos are complete. Here's what I built, following the plan.

## Analysis machinery + first signal (`repo_last_push`)

**Data model** — Added `AnalysisRun`, `AnalysisSubject` (with `@@unique([analysisRunId, type, name])` for in-run dedup), and `AnalysisResult` to [prisma/schema.prisma](prisma/schema.prisma) and applied with `npm run db:push` (shared dev/prod DB).

**Endpoint entrypoint** — [app/api/analysis/client.ts](app/api/analysis/client.ts): the `RISK_SCORES`/`RESULT_STATUSES`/`SUBJECT_TYPES` constants, the pure `deriveStatus` helper, all request/response types, and the browser functions `createAnalysis` / `getAnalysis` / `listAnalyses`.

**Signal registry** — [lib/analysis/signals.ts](lib/analysis/signals.ts): `REPO_SIGNALS` seeded with `repo_last_push` (green ≤1mo, yellow ≤6mo, red older; guards a null `pushed_at`), and an empty `PACKAGE_SIGNALS`.

**Detached orchestrator** — [lib/analysis/orchestrator.ts](lib/analysis/orchestrator.ts): `runAnalysis(runId)` runs after the response. Phase 1 resolves the source repo (fatal `run.error` on failure), optionally adds the source package, enumerates direct deps across all four groups, creates package subjects (linking `npmPackageId` + storing the packument `repository.url`), and dedups linked repo subjects by URL. Phase 2 computes each pending result sequentially, with `safeRunSignal` isolating per-signal failures.

**Route** — [app/api/analysis/route.ts](app/api/analysis/route.ts): `POST` (normalize + validate → 400 `invalid_url`, create run, `after(() => runAnalysis)`), `GET ?id` (detail with derived statuses), and `GET` (summary list).

**Server GitHub client** — Added [app/api/sources/github/client.server.ts](app/api/sources/github/client.server.ts) (and exported `ENDPOINT`/`toError` from the browser client) so the server-side orchestrator resolves repos via `serverApiClient`.

**UI** — Repurposed [app/home-search.tsx](app/home-search.tsx) (buttons + input now create an analysis and redirect), added the polling detail page [app/ui/analysis/[id]/page.tsx](app/ui/analysis/[id]/page.tsx) and the list page [app/ui/analysis/page.tsx](app/ui/analysis/page.tsx), plus a nav link on [app/ui/page.tsx](app/ui/page.tsx). Empty package subjects render "No signals yet".

**Verification** — `npm run lint` and `npm run build` both pass. End-to-end smoke test on `anthropics/anthropic-sdk-typescript` produced 24 deduped repo subjects + 27 package subjects, the run derived `completed`, and `repo_last_push` hit all three risk levels (green for active repos, yellow for `json-schema-to-ts`, red for stale ones like `ts-node`/`deep-object-diff`).

One note from testing: an analysis of `phritz/isitsketchy` produced only the repo subject because its cached GitHub blob has `packageJsonMissing: true` (no root `package.json` on its default branch), so there were no dependencies to enumerate — a data condition, not a code issue.

