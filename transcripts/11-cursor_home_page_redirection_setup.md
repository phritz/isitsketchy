# Home page redirection setup
_Exported on 7/1/2026 at 16:00:10 CDT from Cursor (3.9.16)_

---

**User**

place the home page at /ui, redirecting from / to /ui. we want the entrypoint to be authenticated

---

**Cursor**

Done. The home page now lives at `/ui` (behind Basic auth via the existing `middleware.ts` matcher), and `/` redirects there.

- `app/ui/page.tsx` — the home page (moved from root).
- `app/page.tsx` — now just redirects to `/ui`:

```1:5:app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/ui");
}
```

Since `middleware.ts` already matches `/ui/:path*`, the authenticated entrypoint is enforced. The redirect at `/` itself is public, but it immediately sends users to the auth-protected `/ui`.

---

**User**

when building on railway:

  Collecting page data using 8 workers ...
Error: GITHUB_TOKEN is not set. Add it to your environment (see .env.example).

    at module evaluation (.next/server/chunks/[root-of-the-server]__1rajj4g._.js:6:42858)
    at instantiateModule (.next/server/chunks/[turbopack]_runtime.js:853:9)
    at getOrInstantiateModuleFromParent (.next/server/chunks/[turbopack]_runtime.js:877:12)
    at Context.esmImport [as i] (.next/server/chunks/[turbopack]_runtime.js:281:20)
    at <unknown> (.next/server/chunks/[root-of-the-server]__1rajj4g._.js:6:46040)
    at Context.asyncModule [as a] (.next/server/chunks/[turbopack]_runtime.js:525:5)
    at module evaluation (.next/server/chunks/[root-of-the-server]__1rajj4g._.js:6:45987)
    at instantiateModule (.next/server/chunks/[turbopack]_runtime.js:853:9)
    at getOrInstantiateModuleFromParent (.next/server/chunks/[turbopack]_runtime.js:877:12)
    at Context.esmImport [as i] (.next/server/chunks/[turbopack]_runtime.js:281:20)
> Build error occurred

the github token should NOT be included/accessible to web pages, is that why it is trying to include it in build?

---

**Cursor**

Good question, and the short answer is: **no, the token is not being bundled into web pages.** Let me explain what's actually happening and fix it.

## Why it's failing

The token is *not* leaking to the browser. `GITHUB_TOKEN` has no `NEXT_PUBLIC_` prefix, so Next.js will never inline it into client bundles. Your comment in `lib/github-token.ts` is correct on that front.

The real cause is **eager evaluation at module-load time**:

```8:16:lib/github-token.ts
const raw: string | undefined = process.env.GITHUB_TOKEN;

if (!raw) {
  throw new Error(
    "GITHUB_TOKEN is not set. Add it to your environment (see .env.example).",
  );
}

export const GITHUB_TOKEN: string = raw;
```

And `lib/github.ts` uses it at the top level to build the axios instance:

```74:81:lib/github.ts
const githubApi: AxiosInstance = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    ...
```

During Railway's build, Next.js runs the **"Collecting page data"** step, which *imports* your route module (`app/api/sources/github/route.ts` → `lib/github.ts` → `lib/github-token.ts`). That import triggers the top-level `throw`. Railway generally does **not** inject your runtime env vars into the build step, so `GITHUB_TOKEN` is undefined there and the build dies — even though your route is `force-dynamic` and would only ever need the token at request time.

So the `force-dynamic` gives you dynamic *rendering*, but it doesn't stop the module from being *imported* (and thus evaluated) during build.

## The fix: read the token lazily

Make the token read + client creation happen on first request instead of at import time. That way the build never needs the token, and you still fail fast on the first real request if it's missing.

Now update `lib/github.ts` to build the axios client lazily:

Now update the two call sites that used `githubApi` as a value:

Let me check for any other references to the old exports:

Done. Here's the summary:

**Your concern (token leaking to pages):** Not the cause — and not happening. Server-only env vars (no `NEXT_PUBLIC_` prefix) are never bundled into client JS.

**Actual cause:** `lib/github-token.ts` and `lib/github.ts` read the token and built the axios client *at module-load time*. Next.js imports those modules during the build's "Collecting page data" step, and Railway doesn't provide runtime env vars to the build, so the top-level `throw` fired.

**Fix:** Made both lazy:
- `getGithubToken()` now reads/validates `process.env.GITHUB_TOKEN` only when called.
- `githubApi()` builds and memoizes the axios instance on first request.

Now the module can be safely imported during build (no token needed), while still failing fast on the first real request if the token is missing at runtime.

One thing to verify on Railway: make sure `GITHUB_TOKEN` is set as a **runtime** variable on the service (which it should be for request-time use). It no longer needs to be present at build time.

