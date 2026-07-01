# Basic auth implementation plan
_Exported on 7/1/2026 at 15:59:23 CDT from Cursor (3.9.16)_

---

**User**

let's add basic auth to this demo. everything under /ui shoudl require basic auth username 'demo' password 'notsketchy'. api calls should require an auth token that we are going to provide via an envvar. have exactly one way to read the token as part of a client request and receiving a call, it should read the var out of the env at file load time and fail if it is not present. add a helper to lib/ that automatically adds this header to api requests and ensure it is used by our api clients. add a ntoe to agents saying that requests to api must use this token and to fetch via this helper that adds it automatically. anything unclear? let's keep this simple

---

**Cursor**

I'll research the codebase structure to build an accurate plan. Let me explore the key areas.

Let me look at the API client, route, and UI structure.

I have a clear picture of the codebase. Before I write the plan, there's one important design fork I want to confirm, plus a minor detail.

The key tension: your internal API client (`app/api/repos/client.ts`) currently runs in the **browser** (imported by the `"use client"` page at `app/ui/test/page.tsx`). For a lib helper to "automatically add the token header" to those requests, the browser needs the token — which in Next.js means a `NEXT_PUBLIC_` env var that gets inlined into the client bundle. That makes the token visible to anyone who loads a `/ui` page (already gated by basic auth), so it's not a true secret.

**API auth token design**

> **How should the API token work, given the internal clients currently run in the browser?**
> - NEXT_PUBLIC_ token, one shared reader module used by both the client helper (adds header) and middleware (validates). Simple; token is embedded in the browser bundle behind basic auth. (Recommended) ✔
> - Keep the token a true server-only secret; API calls must be server-to-server only (would require moving repo client usage out of the browser / adding a proxy). More work.

> **What header should carry the API token?**
> - Authorization: Bearer <token> (standard; /api and /ui use different paths so no conflict with basic auth) (Recommended) ✔
> - Custom header, e.g. x-api-token: <token>

Both confirmed. NEXT_PUBLIC token with a single shared reader, and `Authorization: Bearer`. Here's the plan.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll implement the plan. Let me start by marking the first todo in progress and creating the token reader.

All six todos are complete and there are no linter errors. Here's what I implemented:

- **`lib/api-token.ts`** — the single place the token is read (`NEXT_PUBLIC_API_TOKEN`), evaluated at module load, throwing immediately if absent.
- **`lib/api-client.ts`** — an `apiClient` axios instance that attaches `Authorization: Bearer <token>` automatically, using `API_TOKEN`.
- **`middleware.ts`** — one middleware gating both paths: HTTP Basic auth (`demo` / `notsketchy`) for `/ui/*`, and bearer-token validation for `/api/*`, with the matcher scoped to those two path prefixes. Both the client helper and this middleware import the token from the same `lib/api-token.ts`, so there's exactly one reader on each side of a call.
- **`app/api/repos/client.ts`** — now uses `apiClient` instead of raw `axios`.
- **`.env.example`** — documents `NEXT_PUBLIC_API_TOKEN`.
- **`AGENTS.md`** — new "Auth" section stating `/api` requests require the token and must go through the `apiClient` helper, and that the token is read in exactly one place.

One thing worth flagging: because the internal clients run in the browser, the token is embedded in the client bundle (that was the confirmed `NEXT_PUBLIC_` tradeoff), so its real protection comes from the basic-auth gate on `/ui`. Anyone with the basic-auth credentials can read the token from the bundle — expected for this demo, but not a true secret.

---

**User**

confirm: there are client calls for node (in the server) and in the browser, that both add the token and it is clear in agents which to use and also in the source file

---

**Cursor**

Let me examine the current state of the relevant files to verify the server vs. browser situation.

Honest answer: **not yet.** I checked the three places. Here's the precise state:

- **Token adding — works for both:** `apiClient` in [lib/api-client.ts](lib/api-client.ts) sets the `Authorization: Bearer` header at the axios-instance level, so any call through it attaches the token whether it runs in the browser or in Node. That part is genuinely environment-agnostic.

- **Actual calls — only the browser path works:** the endpoint uses a **relative** URL:

```29:37:app/api/repos/client.ts
const ENDPOINT: string = "/api/repos";

export async function listRepos(): Promise<Repo[]> {
  const res = await apiClient.get<ListReposResponse>(ENDPOINT);
```

  In the browser, `/api/repos` resolves against `window.location.origin`. In **Node**, axios uses the http adapter and a bare relative URL like `/api/repos` throws (`Invalid URL`) because there's no origin/`baseURL`. So a server-side call would add the token but fail to resolve. Also, there is currently **no** server-side caller in the codebase — only the browser test page.

- **Docs/source clarity — not addressed:** neither [AGENTS.md](AGENTS.md) nor the source distinguishes a node vs. browser client. There's just one `apiClient` with no note about environments.

So to make your statement true, I need to make `apiClient` work server-side too (give it a `baseURL` when `typeof window === "undefined"`) and document node-vs-browser usage in both AGENTS.md and the source. The one decision I need from you is how the server should resolve the base URL:

**Server-side base URL**

> **How should the server-side (Node) client resolve the base URL for our own /api?**
> - Add an env var (e.g. APP_BASE_URL / NEXT_PUBLIC_APP_URL) that apiClient uses as baseURL when running on the server; browser keeps relative URLs. (Recommended)
> - We won't call our own API from the server (it's browser-only for now). Just make AGENTS.md + source clear that apiClient is browser-side, and leave a documented guard for server use.
>
> Answer: A add env var. but also lets have the two clients be in different source files so that you cannot accidentally use the server client in browser or vice versa

Good call on separate files to prevent cross-environment misuse. Let me verify the `server-only` / `client-only` guard packages are available, then set up the todos.

`client-only` exists but `server-only` isn't resolvable at top level. Let me check where it lives.

---

**User**

dont worry about enforcing it, just clearly name the files and put a comment in each

---

**Cursor**

Got it — clear naming and a comment in each, no runtime enforcement. Let me set up the work.

Done. There are now two clearly named clients, each with a comment stating its environment and warning against cross-use (no runtime enforcement, per your call):

- **[lib/api-client.browser.ts](lib/api-client.browser.ts)** — `browserApiClient`, relative URLs, for `"use client"` / browser code.
- **[lib/api-client.server.ts](lib/api-client.server.ts)** — `serverApiClient`, absolute `baseURL` from `APP_BASE_URL`, for Node/server code.

Both attach `Authorization: Bearer <token>` automatically and pull the token from the single reader in [lib/api-token.ts](lib/api-token.ts). Supporting changes:

- Deleted the old combined `lib/api-client.ts`.
- [app/api/repos/client.ts](app/api/repos/client.ts) now imports `browserApiClient` (its only caller is the browser test page; the `route.ts` uses type-only imports, so nothing server-side breaks).
- Added `APP_BASE_URL` to [.env.example](.env.example) with a note that the server client fails fast without it.
- [AGENTS.md](AGENTS.md) now documents both clients and when to use each.

No linter errors.

Confirming your original statement, now accurate: there are token-attaching clients for both Node (`serverApiClient`) and the browser (`browserApiClient`); both add the token; and which to use is clear in AGENTS.md and in a comment at the top of each source file.

---

**User**

also move the http basic name and password out of the middleware file into an envvar! have exactly one way to get it that throws at file load time if not present

---

**Cursor**

I'll create a single reader module for the basic-auth credentials, then wire it into the middleware and `.env.example`.

Done. The basic-auth credentials are now env-driven with a single fail-fast reader, mirroring the token pattern:

- **[lib/basic-auth.ts](lib/basic-auth.ts)** — the only place `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` are read from the environment, at module load, throwing immediately if either is missing.
- **[middleware.ts](middleware.ts)** — no longer hardcodes `demo` / `notsketchy`; it imports both from `lib/basic-auth.ts`.
- **[.env.example](.env.example)** — adds `BASIC_AUTH_USER="demo"` and `BASIC_AUTH_PASSWORD="notsketchy"` with a note that the app fails to start if either is missing.

No linter errors.

One note: `middleware.ts` runs in Next's Edge runtime, so these must be set as environment variables available at runtime (not just build time) for the middleware to boot — same as before, just now sourced from env instead of literals.

---

**User**

how should i set APP_BASE_URL in railway? ap is running at https://is-it-sketchy.up.railway.app/ 

---

**Cursor**

Set it to your app's public origin (scheme + host, no trailing slash):

```
APP_BASE_URL=https://is-it-sketchy.up.railway.app
```

In Railway: open your service → **Variables** tab → **New Variable** → name `APP_BASE_URL`, value above → deploy. (Do the same for the other required vars: `NEXT_PUBLIC_API_TOKEN`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`, and your existing `DATABASE_URL`.)

A few notes specific to this setup:

- **No trailing slash.** The server client uses this as an axios `baseURL` and joins paths like `/api/repos`, so `https://is-it-sketchy.up.railway.app` + `/api/repos` gives the correct URL. A trailing slash would still work with absolute paths, but dropping it avoids surprises.
- **Optional: reference Railway's built-in domain var** instead of hardcoding, so it stays correct if the domain changes:

```
APP_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
```

  `RAILWAY_PUBLIC_DOMAIN` resolves to `is-it-sketchy.up.railway.app` (host only, no scheme), which is why the `https://` prefix is added manually.

- **`APP_BASE_URL` is only needed if/when server-side code actually imports `serverApiClient`** ([lib/api-client.server.ts](lib/api-client.server.ts)) — that module throws at load if it's unset. Your current caller (the browser test page) uses `browserApiClient` and doesn't need it, but setting it now avoids a surprise the first time you add a server-side API call.
- Since dev and prod point at the same Railway Postgres, if you run the server locally you'd typically set `APP_BASE_URL=http://localhost:3000` in your local `.env` while Railway keeps the public URL.

---

**User**

i have NEXT_PUBLIC_API_TOKEN set in railway but i see this in railway build:

Error: NEXT_PUBLIC_API_TOKEN is not set. Add it to your environment (see .env.example).

    at module evaluation (.next/server/chunks/ssr/[root-of-the-server]__1z_jqzx._.js:6:42809)
    at instantiateModule (.next/server/chunks/ssr/[turbopack]_runtime.js:853:9)
    at getOrInstantiateModuleFromParent (.next/server/chunks/ssr/[turbopack]_runtime.js:877:12)
    at Context.commonJsRequire [as r] (.next/server/chunks/ssr/[turbopack]_runtime.js:302:12) {
  digest: '2946296169'
}

---

**Cursor**

Let me check how the app is built on Railway (Dockerfile vs Nixpacks), since that determines whether build-time env vars reach `next build`.

The culprit is almost certainly the `Dockerfile`. Let me read it.

Found it. Your build uses a `Dockerfile`, and the builder stage never receives `NEXT_PUBLIC_API_TOKEN`:

```11:19:Dockerfile
# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Regenerate the Rust-free Prisma client into the source tree (lib/generated).
RUN npx prisma generate
RUN npm run build
```

Here's what's happening: `NEXT_PUBLIC_*` variables are **inlined at build time** by Next (they get baked into both client and server bundles). During `next build`, Next prerenders `/ui/test`, which pulls in `lib/api-token.ts` → the module evaluates `process.env.NEXT_PUBLIC_API_TOKEN`, finds it undefined, and throws. Your Railway variable *is* set, but for **Dockerfile** builds Railway only exposes service variables to the build if you declare them as `ARG`s — otherwise `npm run build` runs without them. (This differs from Nixpacks, which injects them automatically.)

The fix is to declare the build arg and promote it to an env var before the build. Let me apply it.

Applied. Here's the full picture and what to do next.

**Redeploy** so the build picks up the new `Dockerfile`. Railway automatically supplies your service variables as build args to Dockerfile builds once an `ARG` with the matching name is declared, so `ARG NEXT_PUBLIC_API_TOKEN` will now receive your Railway value and `next build` can inline it.

Why only this one variable needs the `ARG` treatment:

- **`NEXT_PUBLIC_API_TOKEN`** — read via `lib/api-token.ts`, which is inlined at build time and evaluated during prerender. Must exist at build → needs the `ARG`/`ENV` (now added).
- **`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`** — read by `middleware.ts` at runtime (edge), not during build. Railway injects them into the running container, so no Dockerfile change needed.
- **`APP_BASE_URL`** — only imported by `serverApiClient`, which nothing imports yet, so it isn't evaluated at build or runtime currently. Runtime-only when you add a server-side caller.
- **`DATABASE_URL`** — runtime-only (Prisma client at request time). No build arg needed.

Two things worth knowing:

- Because `NEXT_PUBLIC_API_TOKEN` is now **baked into the image at build time**, rotating the token requires a **rebuild/redeploy**, not just changing the runtime variable. That's inherent to `NEXT_PUBLIC_` and consistent with the earlier decision that it's browser-visible behind basic auth.
- If you later prefer not to declare each public var in the Dockerfile, switching the service to Nixpacks (removing the Dockerfile) would auto-inject build vars — but your Dockerfile does deliberate things (standalone output, Prisma client copy), so I'd keep the Dockerfile and just add an `ARG` line per `NEXT_PUBLIC_*` var as you add them.

