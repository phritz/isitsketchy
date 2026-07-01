# APP_BASE_URL error
_Exported on 7/1/2026 at 16:01:44 CDT from Cursor (3.9.16)_

---

**User**

error building on railway:

 Collecting page data using 13 workers ...
Error: APP_BASE_URL is not set. The server-side API client needs an absolute base URL (see .env.example).

the var is set. what is the likely cause? dont fix it yet.

---

**Cursor**

The likely cause: `APP_BASE_URL` is set as a Railway **service/runtime variable**, but it's never made available to the Docker **build** stage — and that error is thrown at build time.

Here's the chain:

1. The error fires during Next.js's "Collecting page data" step, which runs inside `RUN npm run build` in the **builder** stage of your `Dockerfile`.

2. During that step, Next.js imports your page modules, which transitively import `serverApiClient`. That module throws at import time if `process.env.APP_BASE_URL` is missing:

```12:18:lib/api-client.server.ts
const baseURL: string | undefined = process.env.APP_BASE_URL;

if (!baseURL) {
  throw new Error(
    "APP_BASE_URL is not set. The server-side API client needs an absolute base URL (see .env.example).",
  );
}
```

3. As your own Dockerfile comment notes, Railway passes service variables into Dockerfile builds **only via declared `ARG`s**. You did this for `NEXT_PUBLIC_API_TOKEN`, but there's no equivalent `ARG APP_BASE_URL` / `ENV APP_BASE_URL` in the builder stage:

```20:24:Dockerfile
ARG NEXT_PUBLIC_API_TOKEN
ENV NEXT_PUBLIC_API_TOKEN=$NEXT_PUBLIC_API_TOKEN
# Regenerate the Rust-free Prisma client into the source tree (lib/generated).
RUN npx prisma generate
RUN npm run build
```

So even though `APP_BASE_URL` is set in Railway, it's only present at **runtime**, not inside the build container — hence the throw during `next build`.

A secondary contributing factor is that `serverApiClient` throws at **module load** rather than lazily (on first request). That's what makes a missing build-time env var fatal to static page-data collection, instead of only mattering when a request actually needs the client.

Two directions for the fix (not applying yet):
- Mirror the token pattern: add `ARG APP_BASE_URL` + `ENV APP_BASE_URL=$APP_BASE_URL` in the builder stage (and pass it as a build arg from Railway).
- Or make `baseURL` lazy so it's only required when a server request is actually made, avoiding the need to have it at build time at all.

---

**User**

make it lazy. no need to test, just do that fix.

---

**Cursor**

I'll make the client lazy via a `getServerApiClient()` function that constructs (and caches) the instance on first use, so the `APP_BASE_URL` check only runs at request time.

Done. The server client is now lazy:

- `lib/api-client.server.ts` exports `getServerApiClient()` instead of a top-level `serverApiClient`. The `APP_BASE_URL` check and axios instance creation now happen on first call and are cached, so importing the module no longer throws.
- Updated both consumers (`app/api/sources/npm/client.server.ts` and `app/api/sources/github/client.server.ts`) to call `getServerApiClient().get(...)`.

Since `next build`'s page-data collection only imports the module (never issues a server request), the missing build-time `APP_BASE_URL` no longer breaks the build, while runtime behavior is unchanged.

One note: `AGENTS.md` still references `serverApiClient` by name. I left it as-is, but let me know if you want me to update that wording to match the new lazy getter.

---

**User**

yes update it please

---

**Cursor**

Updated `AGENTS.md` to reference `getServerApiClient()` and document the lazy construction behavior and why it matters for `next build`.

