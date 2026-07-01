# GitHub and npm API rate limits
_Exported on 7/1/2026 at 15:59:07 CDT from Cursor (3.9.16)_

---

**User**

we are going to be using the github and npm rest apis. what if any rate limits am i likely to hit? are they improved by making authenticated requests? 

---

**Cursor**

Good context — your `plan/signals.md` already has some of this. Let me verify the current numbers against the official docs so the answer is accurate.

Verified against the official docs. Here's the picture for your use case (per-package trust lookups).

## GitHub — yes, auth matters a lot

GitHub has **two separate limits** that both apply to you:

| Limit type | Unauthenticated | Authenticated (PAT/App) |
| --- | --- | --- |
| **Core REST** (`/repos/...`, `/commits`, `/contributors`) | 60 / hour | 5,000 / hour |
| **Search** (`/search/issues`) | 10 / minute | 30 / minute |

Plus **secondary limits** (same whether authed or not): no more than ~100 concurrent requests, don't hammer a single endpoint per minute, and for writes wait ≥1s between requests. On any limit you get `403`/`429` with `retry-after` and/or `x-ratelimit-*` headers.

**What this means for isitsketchy.** Looking at your `plan/signals.md`, one package analysis costs roughly:
- ~3 **core** requests (repo object, commits count, contributors count)
- ~3 **search** requests (open issues, closed issues, latest closed)

So the binding constraints are:

- **Unauthenticated:** the **60/hr core limit** caps you at ~20 packages/hour, and the **10/min search limit** caps you at ~3 packages/min. Effectively unusable beyond a handful of lookups.
- **Authenticated:** core (5,000/hr) is a non-issue (~1,600 packages/hr), and search (30/min) becomes the bottleneck at ~10 packages/min. ~80x improvement on core, 3x on search.

**Conclusion: authenticate.** A single classic PAT (no scopes needed for public data) moves you from ~20 packages/hr to being search-bound at ~10/min.

Two extra levers worth noting:
- **Conditional requests** (send `If-None-Match` with the `ETag`): a `304 Not Modified` does **not** count against your core limit when authenticated — great for caching repo objects.
- **GraphQL** (already flagged in your notes) can collapse repo fields + open/closed issue counts into one call, sidestepping the tight search limit. Its rate limit is a separate point-based budget.

## npm (registry.npmjs.org + api.npmjs.org) — unlikely to be your bottleneck

npm does **not** publish a specific numeric per-request rate limit. What's documented:

- Requests are rate-limited with `429` on excess; respect `Retry-After`.
- **Acceptable use is ~5 million requests/month.** You won't approach that.
- **Auth does raise the ceiling** ("logged-in users … higher rate than anonymous"), but the anonymous rate is generous enough that for per-package lookups (registry packument + downloads point/range = ~2–3 requests each) you're fine unauthenticated.
- **Downloads API shape limits:** single-package range up to 18 months; bulk queries max **128 packages** and **365 days** per call — useful if you ever batch.

For npm I'd stay unauthenticated to keep things simple, add polite throttling + `429`/`Retry-After` backoff, and cache packuments (they have `ETag`/`Last-Modified` too).

## deps.dev

No documented hard rate limit. Be reasonable (throttle + backoff on errors); treat it as best-effort.

## Practical recommendation

1. **Use a GitHub PAT** — biggest win by far. This is the one that actually blocks you.
2. Build a **client-side throttle around GitHub Search** (~30/min authed) since it's the real ceiling — or move issue counts to **GraphQL** to avoid it.
3. **Cache aggressively** with `ETag`/conditional requests (repo objects, packuments); `304`s are free on GitHub core when authed.
4. npm/deps.dev: unauthenticated is fine; just handle `429` + `Retry-After` with exponential backoff.

Want me to fold these findings (auth requirement, the per-package request budget, and the search bottleneck) into `plan/signals.md` so it's captured alongside the endpoints?

---

**User**

sketch the design of a simple in memory rate limiter. instantiate with the limit per minute and a string indicating which limit this is for. use a leaky bucket model or something equally simple. we will put it in lib/ along with some unit tests. sketch it now but dont implement it yet

---

**Cursor**

Here's the design sketch — no implementation yet.

## Model choice

A **token bucket** fits "N per minute" more naturally than a strict leaky bucket, and it's just as simple. It allows a normal burst up to the limit and then paces subsequent calls, which is exactly what we want when pacing GitHub/npm calls under their per-minute ceilings. Implemented with **lazy refill** (compute available tokens from elapsed time on each call) — no background timers or intervals to manage.

## Location & files

- `lib/rate-limiter.ts` — the class
- `lib/rate-limiter.test.ts` — unit tests (colocated, matching how `lib/` is laid out)

## Public shape

```typescript
export type RateLimiterOptions = {
  limitPerMinute: number;
  name: string; // identifies which limit, e.g. "github-search"
};

export class RateLimiter {
  constructor(options: RateLimiterOptions);

  // Non-blocking: consume one token if available, else false. No waiting.
  tryAcquire(): boolean;

  // Blocking: resolve when a token is available (waits out the deficit).
  acquire(): Promise<void>;

  // Introspection (handy for tests/telemetry)
  get name(): string;
  availableTokens(): number; // current tokens after a lazy refill
}
```

I'd lean on `acquire()` as the primary entrypoint for the analysis pipeline (call it before each outbound request so it self-paces), with `tryAcquire()` available for fast-fail paths.

## Internal state

- `capacity: number` — equals `limitPerMinute` (max burst)
- `refillPerMs: number` — `limitPerMinute / 60_000`
- `tokens: number` — fractional token count
- `lastRefillMs: number` — timestamp of last refill
- `name: string`

## Core algorithm

**`refill()`** (private, called at the start of every public method):

```
now = Date.now()
elapsed = now - lastRefillMs
tokens = min(capacity, tokens + elapsed * refillPerMs)
lastRefillMs = now
```

**`tryAcquire()`**: `refill()`; if `tokens >= 1` → `tokens -= 1; return true` else `return false`.

**`acquire()`**: `refill()`; if `tokens >= 1` consume and resolve immediately. Otherwise compute `waitMs = ceil((1 - tokens) / refillPerMs)`, wait that long (`setTimeout`), then consume. To keep it correct under concurrent `acquire()` calls in one process, I'll **chain waiters on a promise queue** (each waiter reserves its slot in order) so N simultaneous callers don't all think the same single token is theirs.

## Design decisions to confirm

- **Burst = full limit.** Starts full (`tokens = capacity`), so the first `limitPerMinute` calls go through instantly, then pacing kicks in. Alternative: start empty for strictly smooth output. I'd default to starting full.
- **Scope: single process, in-memory.** No cross-instance coordination (fine for now; a Redis-backed version can come later if we run multiple workers).
- **`name` usage:** used in error messages / logs (e.g. a timeout or a thrown error identifies which limiter). No functional role beyond identification.
- **Time source:** `Date.now()` directly. For deterministic tests I'd optionally accept an injectable `now: () => number` in `RateLimiterOptions` — flag this if you want it, since it makes the tests much cleaner without real waiting.

## Planned unit tests

- Allows exactly `limitPerMinute` immediate `tryAcquire()` calls, then returns `false`.
- After the refill interval elapses, `tryAcquire()` succeeds again (drive via injected clock).
- `availableTokens()` refills proportionally to elapsed time and caps at `capacity`.
- `acquire()` resolves immediately when tokens exist; delays ~`60000/limitPerMinute` ms when empty.
- Ordered concurrency: several `acquire()` calls at once resolve in sequence, none double-spending a token.
- `name` is exposed and appears in the relevant error/log path.

One thing to decide before I implement: **do you want the injectable clock** (`now`) for testable timing? I recommend yes — it lets tests run instantly and deterministically instead of using real timers. Want me to go ahead and build it this way?

---

**User**

go for it, and use an injectable clock

---

**Cursor**

No test runner yet. I'll add Vitest (fast, TS-native, minimal config), then implement the limiter and tests.

Now add the test script.

Now implement the limiter with an injectable clock.

All 7 tests pass. Now lint check.

Done. Built the token-bucket limiter with an injectable clock, plus a full test suite. All 7 tests pass and both files lint clean.

## What I added

**`lib/rate-limiter.ts`**
- `Clock` type (`now()` + `sleep()`) with a `systemClock` export for real use (`Date.now()` / `setTimeout`).
- `RateLimiter` class constructed with `{ limitPerMinute, name, clock }`:

```42:53:lib/rate-limiter.ts
  constructor(options: RateLimiterOptions) {
    if (options.limitPerMinute <= 0) {
      throw new Error(
        `RateLimiter "${options.name}": limitPerMinute must be > 0, got ${options.limitPerMinute}`,
      );
    }

    this.capacity = options.limitPerMinute;
    this.refillPerMs = options.limitPerMinute / MS_PER_MINUTE;
    this.limitName = options.name;
    this.clock = options.clock;
```

- `tryAcquire(): boolean` (non-blocking), `acquire(): Promise<void>` (waits, ordered queue so concurrent callers don't double-spend), `availableTokens()`, and `name`. Lazy refill via elapsed time — no timers.

**`lib/rate-limiter.test.ts`**
- A `ManualClock` implementing `Clock` where `advance(ms)` moves time and resolves due `sleep`s deterministically.
- Covers: name exposure, invalid-limit rejection, burst-then-block, proportional refill + capacity cap, immediate `acquire`, waiting `acquire`, and ordered concurrent `acquire`.

**Config**
- Added `vitest` (dev) and scripts: `test` (`vitest run`) and `test:watch`.

## Notes / decisions
- Bucket **starts full** (allows an initial burst up to `limitPerMinute`), as discussed.
- No default params, explicit types throughout, no `any` — per the repo conventions. `clock` is required (real callers pass `systemClock`).
- Vitest chosen as the runner since none existed; it's TS-native and needed no extra config.

Usage will look like `new RateLimiter({ limitPerMinute: 30, name: "github-search", clock: systemClock })`, then `await limiter.acquire()` before each outbound request. Want me to wire this into the GitHub/npm clients next?

---

**User**

udpate @plan/sources-github.md to sya we use this utility and suggest values with reasonable headroom, assuming we are making authenticated requests

---

**Cursor**

Updated. The change to the "GitHub API Usage" section now:

- States we assume **authenticated** requests and treats a missing token as misconfiguration.
- Says we wrap every call in the shared `RateLimiter` (`lib/rate-limiter.ts`), calling `acquire()` before each request.
- Suggests two singleton limiters with headroom, since GitHub meters core and Search separately:
  - `github-core`: `limitPerMinute: 60` → 3600/hr, ~28% under the 5000/hr core cap.
  - `github-search`: `limitPerMinute: 24` → 20% under the 30/min Search cap.
- Notes instantiating with `systemClock` as module-level singletons so all requests share one bucket.

The values are deliberately conservative to also avoid GitHub's secondary anti-burst limits, while leaving comfortable margin under the primary caps.

