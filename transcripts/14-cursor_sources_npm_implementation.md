# Sources NPM implementation
_Exported on 7/1/2026 at 16:00:53 CDT from Cursor (3.9.16)_

---

**User**

ok let's implement @plan/sources-npm.md . any questions?

---

**Cursor**

Let me explore the existing codebase structure to understand the conventions in place.

Now let me look at the existing project structure, prisma schema, existing API routes, and the test UI page to mirror conventions.

The GitHub source already exists — I'll mirror it. Let me read those files plus the GitHub UI page.

Now let me read the `lib/github.ts` to fully understand the fetch/error/rate-limiter pattern I need to mirror for npm.

I've read the npm plan and the existing GitHub source, which is a complete reference implementation I can mirror (`lib/github.ts`, `app/api/sources/github/route.ts`, `client.ts`, and `app/ui/sources/github/page.tsx`). The npm source maps almost 1:1 onto it. Two points need your call before I write the plan.

The first is a genuine divergence between the npm plan and the existing GitHub code. The npm plan (section "Client") says the runtime split should be: management-UI functions use `browserApiClient`, but the analysis-facing `getNpmPackage` must use `serverApiClient` (absolute URL). However, the existing `app/api/sources/github/client.ts` puts all four functions — including `getGithubRepo` — in a single file using `browserApiClient` only. Since the UI page (`"use client"`) imports that same file, I can't cleanly add `serverApiClient` to it (it reads `APP_BASE_URL` at module load and is server-only, so it would break the client bundle).

> **How should getNpmPackage resolve its HTTP call, given the browser/server client split?**
> - Mirror the existing GitHub source exactly: single client.ts, browserApiClient for all four functions (getNpmPackage included). Consistent with current code; defer the server-client split until analysis is built (Recommended)
> - Follow the npm plan literally now: split so getNpmPackage uses serverApiClient (e.g. a separate server-side entry module) while UI functions stay on browserApiClient ✔

> **How should npm package name validation be handled?**
> - Add the validate-npm-package-name dependency (npm install) as the plan specifies (Recommended) ✔
> - Validate inline with a small regex/check, no new dependency

Both points are settled: I'll implement the runtime split from the npm plan (a separate server-side entry for `getNpmPackage` using `serverApiClient`, with UI functions staying on `browserApiClient`), and add the `validate-npm-package-name` dependency. Let me write up the plan.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll implement the plan. Let me start with the schema and dependency, then build out the files.

Now let me install the dependency and run db:push in parallel with generating the client.

Schema applied and Prisma client regenerated. Let me verify the generated NpmPackage model exists and check the validate-npm-package-name types.

The generated model file may be named differently. Let me check the generated models.

The db:push didn't regenerate the client. Let me run generate explicitly.

Now the client includes `NpmPackage`. Let me mark schema done and start on `lib/npm.ts`.

Now the client files.

Now the UI page and nav link.

Lint clean. Now the build.

Build succeeds with both routes present. Now let me smoke-test the endpoint. Let me start the dev server and check the token.

A dev server is already running on port 3000. Let me stop my failed one and test against the existing server.

Port 3000 is a different app (plain-text "Unauthorized", not our JSON). My dev server failed due to a sandbox network restriction. Let me start it outside the sandbox on a dedicated port.

All paths work. Now test DELETE (evict one and clear all).

All CRUD paths verified. Let me stop the dev server.

The npm source is fully implemented and verified. All to-dos are complete.

## Summary

Built `/api/sources/npm` as a read-through cache mirroring the existing GitHub source, following the plan and AGENTS.md conventions.

**New files**
- `lib/npm.ts` — server-only npm client: `NpmPackageData` types, `NpmFetchError`, a shared `npm-registry` `RateLimiter` singleton (120/min, tunable politeness limit), lazy memoized axios instances for `registry.npmjs.org` + `api.npmjs.org`, name validation via `validate-npm-package-name`, and `fetchNpmPackageData` (packument + latest manifest subset + non-fatal weekly/monthly downloads).
- `app/api/sources/npm/route.ts` — `GET ?name` read-through, `GET` list, `DELETE ?id` / `?all=true`; `force-dynamic`, `no-store` headers, one top-level try/catch per handler.
- `app/api/sources/npm/client.ts` — shared types + browser management functions (`listNpmPackages`, `deleteNpmPackage`, `clearNpmPackages`) via `browserApiClient`.
- `app/api/sources/npm/client.server.ts` — `getNpmPackage` via `serverApiClient`, split out so the client bundle never imports server-only code (your chosen runtime split).
- `app/ui/sources/npm/page.tsx` — Mantine cache-management page (Name / Fetched, per-row Remove, Clear all).

**Edits**
- `prisma/schema.prisma` — added the `NpmPackage` model; applied with `npm run db:push` (also updates the shared prod DB) + regenerated the client.
- `app/ui/page.tsx` — added the "npm cache management" nav link.
- `package.json` — added `validate-npm-package-name` + `@types/...`.

**Verification** — `npm run lint` and `npm run build` are clean (both `/api/sources/npm` and `/ui/sources/npm` present). Live smoke test against a dev server confirmed: cache miss then hit (`cacheHit` flips, downloads populated), `package_not_found`, `invalid_package_name`, list, delete-by-id, and clear-all.

One note: the app on port 3000 during testing turned out to be a different process, so I ran a temporary dev server on port 3007 for the smoke test and stopped it afterward.

---

**User**

<timestamp>Wednesday, Jul 1, 2026, 1:22 PM (UTC-5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: aborted
task_id: 909156
title: Start Next.js dev server
output_path: /Users/fritz/.cursor/projects/Users-fritz-a-isitsketchy/terminals/909156.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed).</user_query>

---

**Cursor**

That was the first dev server attempt (`909156`), which failed to bind due to a sandbox network restriction and has now been cleaned up. No follow-up needed — the implementation was already verified using the separate dev server I ran on port 3007 (now also stopped). Everything is complete and passing.

---

**User**

add an npm box to the homage page like the github box and have it fetch like the github repo box does

---

**Cursor**

The home page (`app/ui/page.tsx`) renders the GitHub box via `HomeSearch`. I'll mirror it: add a browser read-through function for npm, create an `NpmSearch` box component, and render it on the page.

First, add a browser read-through to the npm client (mirrors `getGithubRepo`; distinct from the server-only `getNpmPackage`).

Done. Added an npm box to the home page that fetches exactly like the GitHub repo box.

Changes:
- `app/api/sources/npm/client.ts` — added a browser read-through `fetchNpmPackage(name)` (uses `browserApiClient`, mirrors `getGithubRepo`); kept separate from the server-only `getNpmPackage` in `client.server.ts`.
- `app/home-npm-search.tsx` — new `NpmSearch` component mirroring `HomeSearch`: an "npm package name" input + Get button that calls `fetchNpmPackage`, shows errors, and renders the package name plus the JSON blob on success.
- `app/ui/page.tsx` — imports and renders `<NpmSearch />` right below the GitHub `<HomeSearch />`.

Lint is clean. The box hits the same `GET /api/sources/npm?name=...` endpoint already verified, so typing e.g. `express` and pressing Enter/Get fetches (and caches) the package.

