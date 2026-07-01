# NPM package entrypoint analysis
_Exported on 7/1/2026 at 16:02:39 CDT from Cursor (3.9.16)_

---

**User**

we are short on time, what would be required to hook up the npm package entrypoint to work like the github repo entrypoint? see @plan/analysis.md and @plan/signals.md . i am considering cutting it from scope if iti s a lot of work or complexity

---

**Cursor**

I'll research the current state of both entrypoints to assess the work involved.

Let me examine the two entrypoint UIs and the analysis orchestration.

Now let me read the orchestrator to understand how subjects are discovered.

Let me look at the npm library and source to understand what dependency info is available for a package root.

Let me check the Prisma schema and the npm source server client.

Let me check the analysis list page and the npm source client (browser).

I now have a complete picture of both entrypoints. Before writing the plan, two scope decisions materially change the effort — let me confirm them.

Key context on what already exists (so the estimate is grounded): the repo entrypoint already does all the heavy lifting the package entrypoint would reuse — resolving an npm package, creating a `package` subject with `PACKAGE_SIGNALS`, linking its self-reported repo into a `repo` subject, per-signal compute, polling UI, and the red/yellow/green detail page. See `addPackageSubject`/`linkPackageRepo` in [lib/analysis/orchestrator.ts](lib/analysis/orchestrator.ts). Today `NpmSearch` in [app/home-npm-search.tsx](app/home-npm-search.tsx) just fetches and dumps JSON; it never creates an `AnalysisRun`. The run is hardcoded to a repo root (`AnalysisRun.repoUrl` + `getGithubRepo(run.repoUrl)`).

So the missing piece is only: let an `AnalysisRun` be rooted on a package instead of a repo. That's a contained change, not a big one.

**npm entrypoint scope**

> **When analyzing an npm package as the root, how deep should it go?**
> - Full parallel to the repo flow (Recommended): the package + its linked GitHub repo + each of its direct dependencies (each dep also gets a package subject + linked repo). Reuses the existing dep fan-out. ✔
> - Minimal: just the package itself + its linked GitHub repo. No dependency fan-out. Least work, smallest analysis.

> **How should we store the package root on AnalysisRun? (affects DB cleanliness vs. speed)**
> - Fastest (Recommended): add one rootType column and reuse the existing repoUrl column to hold the package name for package runs. Repo path untouched; one db:push.
> - Cleaner: add rootType + a dedicated packageName column and make repoUrl nullable. Slightly more type/serialization churn. ✔

Both scope choices confirmed: full dependency fan-out, and the clean schema (dedicated `packageName` + `rootType`, nullable `repoUrl`). Here's the plan.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll implement the plan. Let me start with the schema change and mark the first todo in progress.

The database is unreachable from the sandbox network allowlist. Let me retry with full network access.

Schema applied and Prisma client regenerated. Now the client types.

Now the client types. Let me add the `RootType` union, extend the data types, and add `createPackageAnalysis`.

Now the route.

Now update the serialization in `getRun` and `listRuns`, and the POST catch for `NpmFetchError`.

Now the orchestrator.

Now the npm home box.

Now the detail page header.

The file has changed since I read it. Let me re-read the relevant section.

The file is larger than the initial snapshot (it has a `ProgressPanel`, `terminal`/`stale` logic). My `runRoot` helper was added successfully. Let me update the header block to match current content.

Let me verify the `runRoot` helper is present and check for any other `run.repoUrl` usages in this file.

Header handled. Now the list page.

The list page may also differ from my snapshot. Let me re-read it before editing.

All todos done. Let me verify no lint/type errors across the edited files.

No lint errors. Let me run a full TypeScript type check to catch any Prisma-typing issues from the regenerated client.

The generated Prisma client is stale (still the old schema shape). Let me regenerate it.

All done. Type check and lint pass clean.

## Summary

The npm package box on the home page now kicks off a real analysis just like the repo box, reusing all the existing subject/signal/dependency machinery.

What changed (all 7 plan items):

1. **[prisma/schema.prisma](prisma/schema.prisma)** — `AnalysisRun.repoUrl` is now nullable; added `rootType` (default `"repo"`) and `packageName`. Applied via `db:push` and regenerated the Prisma client.
2. **[app/api/analysis/client.ts](app/api/analysis/client.ts)** — added `ROOT_TYPES`/`RootType`, threaded `rootType`/`packageName`/nullable `repoUrl` through the run + summary types and `CreateAnalysisRequest`, and added `createPackageAnalysis(name)`.
3. **[app/api/analysis/route.ts](app/api/analysis/route.ts)** — `createRun` branches on `packageName` (validates the npm name, sets `rootType: "package"`); `POST` now also catches `NpmFetchError`; serialization includes the new fields.
4. **[lib/analysis/orchestrator.ts](lib/analysis/orchestrator.ts)** — split discovery into `discoverRepoRoot` (unchanged behavior) and new `discoverPackageRoot`, which resolves the root package (fatal on failure), creates its package subject + linked repo, and fans out over its `dependencies` + `devDependencies`. `discoverAndCompute` branches on `run.rootType`.
5. **[app/home-npm-search.tsx](app/home-npm-search.tsx)** — now calls `createPackageAnalysis` and navigates to `/ui/analysis/{id}` (dropped the JSON dump).
6. **[app/ui/analysis/[id]/page.tsx](app/ui/analysis/[id]/page.tsx)** — header link/label uses a `runRoot` helper (npmjs.com for package roots, GitHub for repo roots).
7. **[app/ui/analysis/page.tsx](app/ui/analysis/page.tsx)** — "Repo" column renamed "Root", rendering `packageName ?? repoUrl`.

Note per the plan: package-rooted dependency fan-out covers `dependencies` + `devDependencies` (all the packument blob distills), vs. the repo path's four groups. Existing repo runs are unaffected (default `rootType="repo"`).

One caveat worth flagging: `db:push` runs against the shared Railway DB, so the schema change is already live in production per the project's deliberate one-DB setup.

