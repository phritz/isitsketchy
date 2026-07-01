# Readme accuracy check
_Exported on 7/1/2026 at 16:04:49 CDT from Cursor (3.9.16)_

---

**User**

check that the readme is accurate 

---

**Cursor**

I'll check the README against the actual state of the project.

Now let me verify the README's claims against the actual project state.

I've reviewed the README against the actual project state. The README is significantly out of date, mostly still describing the original scaffold rather than the app the project has become. Here's what I found.

## Inaccuracies

**Missing product description** ([README.md](README.md) line 3): It only says "a Next.js app using Mantine." It never explains that "Is It Sketchy?" shows trustworthiness signals for GitHub repos / npm packages (per [app/ui/page.tsx](app/ui/page.tsx)).

**Missing env vars** (lines 22-28, [.env.example](.env.example)): README only covers `DATABASE_URL`. The app also requires `NEXT_PUBLIC_API_TOKEN`, `APP_BASE_URL`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`, and `GITHUB_TOKEN`, and the app fails to start if they're missing.

**Missing auth section**: `/ui/*` is behind HTTP Basic auth and `/api/*` requires a bearer token, enforced in [middleware.ts](middleware.ts). Not mentioned at all.

**Stale scratch-page claim** (line 44): References a scratch page at `/ui/test` using a `Repo` table. Neither exists — there's no `/ui/test` page, and the schema models are `GithubRepo`, `NpmPackage`, `AnalysisRun`, `AnalysisSubject`, `AnalysisResult` ([prisma/schema.prisma](prisma/schema.prisma)).

**Missing test script** (lines 46-52): `npm run test` / `npm run test:watch` (vitest) exist in [package.json](package.json) but aren't listed.

**Wrong "Project structure"** (lines 110-117):
- Claims `app/page.tsx` is "the home page" — it's actually just a `redirect("/ui")` ([app/page.tsx](app/page.tsx)). Real home is [app/ui/page.tsx](app/ui/page.tsx).
- Omits `middleware.ts`, the `lib/` API clients + db singleton, `app/api/*` route handlers, the `app/ui/*` pages (analysis, sources, signals), and `prisma/`.

The deployment section (lines 54-108) still looks accurate.

Let me put together a plan to fix these.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Now let me update the README. Starting with the overview.

Let me review the final README for coherence, especially the now-redundant `.env` copy step in the Database section.

Let me streamline the redundant `.env` copy step in the Database section to point at Configuration instead.

All todos are complete. The README now accurately reflects the current app.

Summary of changes to [README.md](README.md):

- **Overview**: Added what the app actually does (trustworthiness signals for GitHub repos / npm packages) and noted it's a Postgres-backed MPA.
- **New Configuration section**: Documents all required env vars (`DATABASE_URL`, `NEXT_PUBLIC_API_TOKEN`, `APP_BASE_URL`, `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD`, `GITHUB_TOKEN`) and the fail-fast behavior.
- **New Auth subsection**: Explains Basic auth on `/ui` and bearer-token auth on `/api` via `middleware.ts`, plus the token-attaching API clients.
- **Database**: Removed the stale `/ui/test` + `Repo` table claim; replaced with the real models (`GithubRepo`, `NpmPackage`, `AnalysisRun`, `AnalysisSubject`, `AnalysisResult`) and a `db:studio` pointer. De-duplicated the `.env` copy step.
- **Scripts**: Added `npm run test` and `npm run test:watch`.
- **Project structure**: Corrected `app/page.tsx` (redirect, not home) and added `app/ui/`, `app/api/`, `middleware.ts`, `lib/`, and `prisma/schema.prisma`.

Deployment (Railway) sections were verified accurate and left unchanged.

