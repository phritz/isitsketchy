# Is It Sketchy app plan
_Exported on 7/1/2026 at 15:57:14 CDT from Cursor (3.9.16)_

---

**User**

let's sketch out the high level plan for building this app, Is It Sketchy? we provide a web interface that accepts a github repo link and we analyze the repo and the associated npm package to surface signals of trustworthiness. we'll have several components:
- web ui that accepts a github repo link and triggers analysis, this goes under /ui. 
- apis to fetch and store and retrieve github repo metadata under /api/sources/github. this is a read-through cache that stores to a database. 
- apis to fetch store retrieve npm package metadata under /api/sources/npm. these endpoints are also a read through cache
- apis to trigger analysis of of a repo and its package; this is under /api/analysis, and uses the sources apis above to get its data

we will flesh the high level plan out in plan/project.md once we are done discussing, and then separately formulate plans for these components. handoffs between components for now are explicit api calls, no queue or anything. clients will poll for status. what more of the high level structure should we discuss?

---

**Cursor**

Let me look at the current state of the repo to ground the discussion.

This is essentially a greenfield repo (just `LICENSE` and a Next.js-flavored `.gitignore`), so we're deciding structure from scratch. Good time to align.

Here are the high-level structural topics I think we still need to nail down before writing `plan/project.md`, grouped by how much they shape everything downstream:

**Foundational (shapes all four components)**
- **Runtime & hosting model.** You've said async analysis with client polling and "no queue." That leaves a real question of *where the analysis work actually runs*: an in-process background task in a long-running Node server, a fire-and-forget serverless invocation, or a separate worker process. This determines whether we can target Vercel-style serverless or need a persistent server.
- **Persistence.** All three data domains (github cache, npm cache, analysis records) need a store. DB choice (Postgres/SQLite/etc.), and whether all components share one schema/DB or each owns its own tables.
- **Project layout.** Single Next.js app (app-router route handlers for the `/api/*` paths + `/ui`) vs. a monorepo with a separate backend. The paths you listed map cleanly to one Next.js app.

**Cross-cutting contracts (shared by components)**
- **Read-through cache semantics.** TTL / staleness policy, forced-refresh option, and what the cache key is (repo full name + commit SHA? npm package + version?).
- **The repo ↔ npm package linkage.** How analysis maps a GitHub repo to its npm package(s) — parse `package.json`, use npm's `repository` field, handle monorepos with multiple packages or repos with none.
- **Analysis lifecycle & status model.** Job states (queued/running/done/failed), the ID scheme, and the exact poll response shape the UI consumes.
- **Shared API conventions.** Standard response/error envelope, IDs, pagination, and data/schema versioning (so cached blobs and analysis outputs can evolve).

**Domain core**
- **What "sketchy" actually means.** The concrete trustworthiness signals and how they roll up into a score/verdict. This is the product's whole value, so worth at least an MVP shortlist (e.g. repo age, contributors, commit recency, stars; npm downloads, maintainer count, install scripts, deprecation, dependency count, known vulns, provenance).

**Secondary (can be deferred but worth noting)**
- External API auth & rate limits (GitHub token, npm registry), plus whether there's any user auth/rate-limiting on our side.

Let me ask the two decisions that most constrain the rest.

**High-level structure decisions**

> **How should analysis actually execute (given async + polling, no queue)? This drives hosting and DB choice.**
> - Long-running Node server with in-process background tasks (analysis runs after returning a job id; state tracked in DB)
> - Serverless / Vercel-style: /api/analysis kicks off a fire-and-forget function invocation, status in DB
> - Separate worker process/service that the API triggers via internal HTTP call
> - Keep it simple: synchronous analysis on first request, DB caches the result (polling just returns cached)
>
> Answer: we will have a long running node process in railway. for now the analysis is a request that starts the analysis and then returns an id that cal be used to poll for status

> **What persistence layer for the caches + analysis records?**
> - Postgres (with an ORM like Prisma/Drizzle) ✔
> - SQLite (local file / libSQL) for simplicity
> - Something else (specify)

> **Project layout?**
> - Single Next.js app (app-router route handlers for /api/*, /ui page) (Recommended) ✔
> - Monorepo: separate Next.js frontend + standalone backend service

Locked in: long-running Node server on Railway with in-process background analysis (start → return id → poll), Postgres + Prisma, single Next.js app (app-router).

A few more contract-level decisions and then I'll write it up.

**Cache, analysis output, and linkage**

> **Read-through cache freshness policy for the github/npm sources?**
> - TTL-based: serve cached if younger than a TTL (e.g. 24h), else refetch; support ?refresh=true to force
> - Cache forever until an explicit refresh is requested
> - Always refetch on analysis, cache only for retrieval/history
>
> Answer: TTL is 24h by default, no need for refresh=true, let's have a very simple set of cache management endpoints under /ui/sources/

> **What should analysis output look like?**
> - Both: a 0-100 score + categorical verdict (e.g. Trustworthy/Caution/Sketchy) + per-signal breakdown (Recommended)
> - Categorical verdict + per-signal breakdown, no numeric score
> - Numeric score only
>
> Answer: defer this

> **How do we link a GitHub repo to its npm package?**
> - Parse package.json at repo root to get the package name, then hit npm (handle 'no package' / private cases)
> - Ask the user to also provide the npm package name in the UI
> - Auto-detect from package.json, but allow user override in the UI (Recommended)
>
> Answer: A, keep it simple, we just fail if there is no package.json and we dont handle private packages

Here's what I've got locked from our discussion:

- **Runtime**: long-running Node server on Railway; analysis is start-and-poll (in-process background work, no queue).
- **Storage**: Postgres + Prisma.
- **Layout**: single Next.js app (app-router route handlers).
- **Cache**: 24h TTL, no force-refresh param; simple cache-management pages under `/ui/sources/`.
- **Linkage**: parse root `package.json` for the npm name; fail if absent; no private packages.
- **Scoring/verdict output**: deferred to the analysis component plan.

That covers the foundational structure. Let me write it up as the high-level plan (destined for `plan/project.md`); the per-component plans come after.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

All to-dos complete. I wrote the high-level plan and the four component plans to `plan/`:

- [plan/project.md](plan/project.md) - high-level architecture, stack (single Next.js app on Railway, Postgres + Prisma), data model sketch, cache semantics, repo→npm linkage, start-and-poll analysis lifecycle, and build order.
- [plan/sources-github.md](plan/sources-github.md) - read-through cache design, `GithubRepo` model, GitHub API usage (repo metadata + root `package.json`), endpoints incl. list/evict for cache management, and the in-process `getRepo` internal API.
- [plan/sources-npm.md](plan/sources-npm.md) - read-through cache design, `NpmPackage` model, registry packument + downloads usage, endpoints incl. list/evict, and the in-process `getPackage` internal API.
- [plan/analysis.md](plan/analysis.md) - `Analysis` model + status enum, POST-to-start / GET-to-poll endpoints, background lifecycle, orchestration steps, MVP signal candidates, versioned result shape, and the explicitly deferred score/verdict roll-up.
- [plan/ui.md](plan/ui.md) - main input→poll→results flow, results/error rendering, and the `/ui/sources/` cache-management pages.

Cross-references between the docs use relative markdown links, and I left the plan file itself untouched.

Two things carried through as intentionally deferred (per our discussion), now recorded in the docs: the analysis output roll-up (score vs verdict vs both) in `analysis.md`, and the exact final signal field set (which slightly influences the cached blob shapes in the sources docs). Those are the natural first decisions when we start implementing the analysis component.

