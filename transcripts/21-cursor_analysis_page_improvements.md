# Analysis page improvements
_Exported on 7/1/2026 at 16:02:09 CDT from Cursor (3.9.16)_

---

**User**

lets improve the analysis page /ui/analysis/$id:
- while analysis is pending, only show status (num repos and packages processed, signals analyzed, etc). make that status more promient
- once analysis is complete show the full results
- bubbles for red/green/etc in full results are clipped
- remove all analyses link


---

**Cursor**

I'll look at the analysis page and related code to understand the current structure.

Now let me look at the client types to understand the data structure.

Let me check the Mantine version and the plan files for context.

Let me verify the Mantine `Collapse` API and check the analysis list page (for the "All analyses" link).

Let me check the app layout and any global CSS for style overrides.

Let me check if a dev server is already running.

I've gathered enough context. The current page shows results while running and hides them behind a redundant status. Now I'll redesign the page. Let me make the edits.

First, the imports and the title/link area:

Now add a progress type and computation helper after the `Buckets` bucketing logic:

Now add the `Stat` and `ProgressPanel` components. I'll place them before `FlagTable`:

Now update `FullResults` to default open (so results are shown when complete) and fix the badge clipping by wrapping the table in a scroll container with roomier spacing:

Now the main component render: remove the "All analyses" link, gate on terminal state to show either the progress panel or the results.

Now let me check for lint/type errors:

Let me review the final result to confirm everything is coherent:

The redesign is complete. Here's what I changed in `app/ui/analysis/[id]/page.tsx`:

**1. Prominent status while pending/running**
Added a `ProgressPanel` (a bordered, shadowed `Paper`) that is the *only* thing shown until the run reaches a terminal state — no partial flag tables anymore. It shows:
- A large spinner + "Analyzing…" heading.
- A context line: "Discovering repositories and packages…" during discovery, then "Evaluating trustworthiness signals…".
- A progress bar with "N of M signals analyzed".
- Big `Stat` counters for Repositories, Packages, and Signals.

A new `computeProgress()` helper derives these counts (repos/packages discovered, total signals, analyzed = completed + failed) from the polled run.

**2. Full results only once complete**
The render now branches on a `terminal` flag (`isTerminal(run.status)`): while not terminal it renders the `ProgressPanel`; once terminal it renders the red/yellow flag sections, green summary, and full results table. The small inline status text is now only shown when terminal (the panel conveys in-flight status).

**3. Fixed clipped red/green bubbles in full results**
- Defaulted the full-results `Collapse` to **open** (`useDisclosure(true)`) so the table renders at natural height immediately rather than being measured/clipped by the collapse transition.
- Wrapped the table in `Table.ScrollContainer minWidth={640}` so the 6-column table scrolls horizontally instead of overflowing/clipping inside the `md` container.
- Bumped row spacing from `verticalSpacing="xs"` to `"sm"` for more room around the badges.

**4. Removed the "All analyses" link**
The header is now just the `Analysis` title (dropped the `Group` wrapper and the `<Anchor href="/ui/analysis">All analyses</Anchor>`). The "← Home" back link is preserved per the project convention.

Lints/types are clean. Since the page polls a live run, you can watch it now show the prominent progress panel first, then swap to full results when the run finishes.

---

**User**

only show "Evaluating trustworthiness signals" when we are actually running the analysis. prior to that show "Gathering metadata..."

---

**Cursor**

I need to fix the ternary — it now lacks the `: null` branch:

Done. The progress panel caption is now driven by the run's status:
- **`running`** → "Evaluating trustworthiness signals…" (with the progress bar shown).
- **`pending`** (before signals start) → "Gathering metadata…" (no progress bar yet).

---

**User**

check that we have sensible behavior if fetches start erroring. also add 10s timeouts to all our calls. propose what to do here before doing it.

---

**Cursor**

Let me explore the fetch/client layer to understand where calls are made and how errors are currently handled before proposing.

Now let me look at the source server clients and the analysis orchestration to understand how upstream errors propagate.

Let me find the analysis orchestration and how it handles errors during subject resolution.

I've now traced every place we make HTTP calls and how errors flow. Here's what I found and what I propose — no changes made yet.

## Where we make calls (6 axios instances)

**External (upstream) calls** — the real hang risk, none have timeouts today:
- `githubApi()` in `lib/github.ts` (repo metadata, package.json, contributors, commits, issue search)
- `registryApi()`, `downloadsApi()`, `depsDevApi()` in `lib/npm.ts`

**Internal (our own API) calls** — also no timeouts:
- `browserApiClient` (`lib/api-client.browser.ts`): browser → `/api/analysis` (poll/list/create)
- `getServerApiClient()` (`lib/api-client.server.ts`): orchestrator → `/api/sources/github` and `/api/sources/npm`

## Current error behavior (what's sensible vs not)

Sensible already:
- Upstream **enrichment** failures (contributors, commits, issues, downloads, dependents) are swallowed to `null` — good.
- Upstream **core** failures propagate as typed errors and are caught in `orchestrator.ts`: source repo failure → fatal `run.error`; a dependency's failure → per-subject `error` with its results failed. One bad signal is isolated by `safeRunSignal`. So a completed run degrades gracefully.

Not sensible (two gaps):
1. **No timeouts anywhere.** If GitHub/npm/deps.dev accepts the connection but never responds, the orchestrator's Phase 1 is sequential and will hang forever. The run stays `running`/`pending` indefinitely and the page polls forever. This is the main correctness problem.
2. **The polling loop gives up on the first error.** In `app/ui/analysis/[id]/page.tsx`, `poll()`'s `catch` sets an error and does *not* reschedule. A single transient blip (or a newly-added timeout on one poll) permanently stops live updates and shows a hard error, even though the detached run is fine. Adding timeouts makes this worse, so it should be fixed alongside.

## Proposed changes

1. **10s timeout on all external upstream instances** (`githubApi`, `registryApi`, `downloadsApi`, `depsDevApi`) via `timeout: 10000`. This is the key fix: a hung upstream now fails fast, and existing catch logic turns it into a null enrichment / subject error / fatal run error as appropriate. I'll add a shared `const UPSTREAM_TIMEOUT_MS = 10000`.

2. **10s timeout on `browserApiClient`.** Its endpoints are quick DB-backed operations (poll a run, list runs, create-and-return-id with detached orchestration), so 10s is safe and appropriate.

3. **Make the poll resilient** (needed once timeouts exist): while the run is non-terminal, keep polling on a failed request instead of giving up. I'll show a subtle "Reconnecting…" note rather than a hard error, and only surface a hard error if the very first load fails (nothing to show yet). This keeps the live page robust to transient blips/timeouts.

## The one decision I want to confirm

The **server-internal client** (`getServerApiClient`, orchestrator → our source endpoints) is the tricky one. On a **cache miss** that endpoint runs the full read-through: a rate limiter (GitHub core is 60/min, Search 24/min) plus up to ~6 upstream calls that each can now take up to 10s. A strict 10s timeout here would frequently kill legitimate slow read-throughs (false failures), even though each individual upstream call is already bounded to 10s.

> **How should the server-internal API client (orchestrator → our /api/sources/* endpoints) be timed out? It wraps rate-limited, multi-step read-throughs, so a strict 10s can cause false failures on cache misses.**
> - Recommended: 10s on all external upstream calls + browser client, but give the internal server client a generous 60s budget (it wraps several rate-limited upstream calls)
> - Strict 10s everywhere, including the internal server client (accept possible false failures on slow cache-miss read-throughs)
> - 10s on external upstreams + browser client only; leave the internal server client with no timeout (rely on upstream timeouts to bound it) ✔

Confirmed: 10s on external upstreams + the browser client, and leave the internal server client untimed. Let me implement.

Now the npm clients (registry, downloads, deps.dev):

Now make the poll resilient. Let me update the polling effect and add a "reconnecting" indicator.

Now surface the "Reconnecting…" indicator in the header group:

Done. Here's what I changed, following the confirmed approach.

**10s timeouts on external upstream calls**
- `lib/github.ts`: added `UPSTREAM_TIMEOUT_MS = 10000` and `timeout` on the `api.github.com` instance.
- `lib/npm.ts`: added `UPSTREAM_TIMEOUT_MS = 10000` and `timeout` on the registry, downloads, and deps.dev instances.

A hung upstream now fails fast within 10s instead of stalling the sequential run forever. The existing catch logic already turns those failures into the right thing: null for enrichment calls, a per-subject error for a dependency, or a fatal `run.error` for the source repo.

**10s timeout on the browser client**
- `lib/api-client.browser.ts`: added `timeout: 10000`. Its endpoints are quick DB-backed ops, so this is a safe fail-fast bound.

**Internal server client left untimed**
- `lib/api-client.server.ts` unchanged — it wraps rate-limited, multi-step read-throughs, and the per-upstream 10s timeouts bound it indirectly.

**Resilient polling** (`app/ui/analysis/[id]/page.tsx`)
- The poll loop no longer gives up on the first error. It tracks whether it has loaded once:
  - Initial load failure → hard error, stop (nothing to show).
  - Failure after data already loaded → keep polling and set a `stale` flag, clearing `error`/`stale` on the next success.
- Added a subtle "Reconnecting…" indicator in the header while `stale` is true, so a transient blip or timed-out poll doesn't tear down the live view.

All four touched files are lint/type clean.

