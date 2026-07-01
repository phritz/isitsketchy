# Is It Sketchy — Approach

## Problem statement

npm supply chain attacks are compromising startups and big tech companies. I wanted 
to build something that gave me a quick sense of how trustworthy a given repo or 
package is. All this information is already out there on the web, but it's not
centralized or easy to consume for this purpose.

## Theme

I chose **Theme 1: Exploration & Understanding**, with elements of developer tools from **Theme 3: Systems & Reliability**. Enabling other developers is something I've spent a lot of my career doing, so this fit naturally.

## Key decisions and tradeoffs

- **Caching the data.** I cache fetched metadata. I was worried about getting rate limited while developing, so caching kept iteration fast and predictable.
- **Modeling the analysis simply.** This is a proof of concept, so I went with a dead-simple analysis model: serial execution and no resumption or individual signal computation. No queues or anything. Processing is detached: the create request returns immediately and the run is processed afterward on the persistent Node server.
- **Next.js.** It simplified the implementation. I could put the backend API calls and the UI in one server.
- **Railway for deployment.** I wanted a persistent server rather than functions (like Vercel) so that rate limiting would work correctly.
- **Postgres.** It was easy. No migrations, just YOLOing the db directly.
- **Signal processing status.** A run happens in two phases: first it discovers the subjects (the source repo, its package, and each direct dependency) and creates one pending result per signal, then it computes those results sequentially. Each signal carries its own per-signal status, and those statuses are aggregated into the full status of the analysis run. This avoids having separate status items on run aggregates and individual work items.

## Known warts (proof of concept)

- **Cache has no TTL.** You have to manually remove an entry to get fresh metadata.
- **Auth is proof-of-concept level.** Basic auth to access the app, plus a hardcoded API token for server-to-server (self-to-self) calls. The API token is included in the JS bundle, so it is present in the browser, which is not ideal. To fix this I would use a proper auth package like BetterAuth and eliminate the self-to-self API key from the JS bundle.
- **Signals need tuning.** The signals probably need some tuning to be more useful.
- **Direct dependencies only.** Right now I only analyze direct dependencies. There is no reason it couldn't recurse into transitive dependencies — the existing model supports it — I had just spent enough time already that I didn't implement it.
- **Dev shares the production database.** Local development and production point at the same Postgres instance, so schema pushes from my machine also change production. This is a deliberate proof-of-concept simplification.
- **Unify caches.** The GitHub and npm package caches are almost identical code, they could easily be unified.

## If I had more time

- **Recurse into transitive dependencies.** Visit dependencies recursively instead of stopping at direct dependencies, so the analysis covers the full dependency tree.
- **Passthrough npm registry.** Implement a passthrough npm registry that hands off packages for analysis, so you could see all the packages you are using even if they are only installed locally.
- **Remove HTTP hops.** Consider eliminating the HTTP hops for getting repo/package data and just calling the functions directly. It would depend on how I want this to scale — if I want separate storage for package and repo metadata, I would keep the HTTP hops.
- **Positive signals.** Instead of green flags for checks that passed, I would treat those as checks passed and reserve green flags for positive signals — for example, the presence of transparency logging for releases, or other evidence of good practices.
- **Failure modes.** I'd tighten up the failure modes and error handling, adding more unit tests. But this is 
a proof of concept so I went light on that.
- **SPEED.** Everything runs sequentially, there is a ton of room for parallelism.
- **Unify caches.** The GitHub and npm package caches are almost identical code, they could easily be unified.

## Time spent

About 4 hours implementing, with a lunch break. About another hour putting together the submission package, including this doc and the video. And now I spent another 30m or so doing a few cleanups.
