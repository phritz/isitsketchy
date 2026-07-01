# Deferred work documentation
_Exported on 7/1/2026 at 16:00:31 CDT from Cursor (3.9.16)_

---

**User**

start a doc for deferred work:
- recursively crawling subpackages
- allowing multiple packages and repos, currently it allows exactly one
- parallelism and background worker
- finding npm package from repo or web
- cache TTL

---

**Cursor**

I'll take a quick look at the existing plan docs to match their style.

Let me check what's in the plan folder already.

I have enough context on the style. I'll create `plan/deferred.md` capturing the five items.

Now I'll link it from `project.md` so it's discoverable.

Created `plan/deferred.md` with all five items and linked it from `project.md`.

Each entry follows a *what we do now → why it's fine → how we'd do it later* structure, matching the style of the existing plan docs:

- **Recursively crawling subpackages** — direct deps only today; later walk the tree with cycle detection, depth caps, and dedup.
- **Multiple packages/repos per run** — exactly one `repoUrl` today; later a batch/list input with subject grouping.
- **Parallelism and background worker** — sequential detached in-process now; later bounded concurrency + a real queue/worker with a resume sweep.
- **Finding the npm package from a repo or the web** — resolved from root `package.json` today; later monorepo/no-manifest and package-first/web-search entrypoints.
- **Cache TTL** — indefinite read-through cache now; later TTLs (possibly per-source) with a "last fetched" timestamp.

I cross-referenced the relevant docs (`analysis.md`, `sources-github.md`, `sources-npm.md`) in each entry. Want me to also drop pointers into those source docs back to the deferred items, or leave the single link in `project.md`?

