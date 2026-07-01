# Update plan for sources
_Exported on 7/1/2026 at 15:59:37 CDT from Cursor (3.9.16)_

---

**User**

let's update @plan/sources-npm.md 
- no cache TTL we will manually manage the cache
- look at @plan/sources-github.md and bring this plan in line with how it works
propose changes to make

---

**Cursor**

I have enough context. Both files describe read-through caches; the GitHub plan is the more mature template. Here is my proposal to bring `plan/sources-npm.md` in line.

---

**User**

re confirmation needed: have the getpackage go through the http client

---

**Cursor**

Confirmed. Let me check how `analysis.md` references the npm source so the plan stays consistent, then update the plan.

Done. The plan now locks in the HTTP-client approach for analysis.

Key points I recorded in the confirmed decision:
- Drop the in-process `lib/sources/npm/getPackage`; analysis calls `getNpmPackage(name)` over HTTP, matching the github source's Client section.
- Runtime caveat per [AGENTS.md](AGENTS.md): analysis is a server-side Route Handler, and `browserApiClient`'s relative URLs break in Node — so the analysis-facing `getNpmPackage` must resolve through `serverApiClient` (`lib/api-client.server.ts`), while the management-UI functions use `browserApiClient`. I flagged that the same subtlety applies to github's `getGithubRepo`.
- Follow-up noted: update [plan/analysis.md](plan/analysis.md) step 4 (`npmSource.getPackage(name)`) to reference the HTTP client for consistency.

The rest of the alignment (no TTL, single `route.ts` with GET read-through + GET list + DELETE by `id`/`all`, no-TTL mermaid, axios + `RateLimiter` singleton, Client + Management UI sections) is unchanged in the plan. Ready to execute when you switch me out of plan mode.

---

**User**

go for it, update plan

---

**Cursor**

I'll switch to agent mode to update the planning docs.

Now I'll rewrite `plan/sources-npm.md` per the confirmed plan.

Now the small consistency edit to `plan/analysis.md` step 4.

Done. Both docs updated:

- [plan/sources-npm.md](plan/sources-npm.md) rewritten to mirror [plan/sources-github.md](plan/sources-github.md):
  - No TTL — an existing row is always a cache hit; delete-to-refresh (updated Responsibility, Data Model refresh policy, and the mermaid flow).
  - Single `app/api/sources/npm/route.ts` with the AGENTS.md preamble, `GET ?name` read-through, `GET` (no name) list, and `DELETE ?id` / `DELETE ?all=true`. Removed the old `/list` sub-route and `DELETE ?name`.
  - Added axios + `npm-registry` `RateLimiter` singleton (noting its limit is a conservative tunable, not a hard cap).
  - Added Client and Management UI sections.
  - Internal API now goes through the HTTP client `getNpmPackage(name)`, with the server-vs-browser client caveat spelled out (`serverApiClient` for analysis, `browserApiClient` for the UI).
- [plan/analysis.md](plan/analysis.md) step 4 now references `getNpmPackage(name)` instead of the in-process `npmSource.getPackage(name)`.

