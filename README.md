# Is It Sketchy?

Is It Sketchy? shows trustworthiness signals for a GitHub repo or npm package, evaluating how "sketchy" it is based on repo and package metadata.

It is a [Next.js](https://nextjs.org) (App Router, TypeScript) multi-page app using [Mantine](https://mantine.dev) for UI, backed by Postgres via Prisma. It is deployed to [Railway](https://railway.com) as a Docker image via the Railway CLI.

See [APPROACH.md](APPROACH.md) for how I approached this project.

## Code overview

The app is a single Next.js server that hosts both the UI and the API.

- **UI pages** (`app/ui/*`, Mantine) let you start an analysis from a GitHub repo URL or an npm package name and watch the result. The detail page (`app/ui/analysis/[id]/page.tsx`) polls the API until the run reaches a terminal status. `/ui/*` is behind HTTP Basic auth and `/api/*` behind a bearer token, both enforced in `middleware.ts`.
- **Analysis API** (`app/api/analysis/route.ts`): `POST` creates an `AnalysisRun` row and schedules the orchestrator via Next.js `after()`, so the request returns immediately with the run id. `GET` lists runs or returns one by id, deriving run/subject status from the individual result statuses.
- **Orchestrator** (`lib/analysis/orchestrator.ts`) runs detached on the persistent Node process in two phases. Phase 1 discovers subjects (the source repo, its package, and each direct dependency's package and linked repo) and creates one pending `AnalysisResult` per applicable signal. Phase 2 computes each result sequentially using the pure signal definitions in `lib/analysis/signals.ts`, writing a `red`/`yellow`/`green` risk score and comment.
- **Data sources** (`app/api/sources/github`, `app/api/sources/npm`) are read-through caches over the GitHub, npm registry, npm downloads, and deps.dev APIs. Fetched blobs are stored in Postgres (`GithubRepo`, `NpmPackage`) with no TTL, so subsequent runs reuse them until an entry is manually evicted (via the cache admin pages or `DELETE`).
- **Data model** (`prisma/schema.prisma`): an `AnalysisRun` has many `AnalysisSubject`s, each of which has many `AnalysisResult`s (one per signal). Cached source blobs live in separate `GithubRepo` / `NpmPackage` tables.
- **API clients**: browser components use `browserApiClient` (`lib/api-client.browser.ts`, relative URLs); server code (including the orchestrator) uses `getServerApiClient()` (`lib/api-client.server.ts`, absolute URL). Both attach the bearer token, and going through the API keeps every fetch on the cached path.

### Rate limiting

Upstream calls go through in-memory, single-process token-bucket limiters in `lib/rate-limiter.ts`, instantiated as module-level singletons: `github-core` and `github-search` in `lib/github.ts`, and `npm-registry` and `deps-dev` in `lib/npm.ts`. Every outbound request `await`s the relevant limiter first. Because the limiters live in process memory, the app is deployed to a persistent Railway server rather than serverless functions so the limits actually hold across requests.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Configuration

Copy `.env.example` to `.env` and fill in the values. The app fails fast on startup if any of these are missing:

```bash
cp .env.example .env
```

- `DATABASE_URL` - Postgres connection string (see [Database](#database) below).
- `NEXT_PUBLIC_API_TOKEN` - token attached as `Authorization: Bearer <token>` on every `/api` request.
- `APP_BASE_URL` - absolute base URL of the app (e.g. `http://localhost:3000`), used by the server-side API client since Node cannot resolve relative `/api` URLs.
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` - HTTP Basic auth credentials guarding all `/ui` routes.
- `GITHUB_TOKEN` - GitHub personal access token for authenticated GitHub REST API calls (raises the rate limit from 60 to ~5000 req/hr). A read-only public-repo token is enough.

### Auth

Access is guarded in [`middleware.ts`](middleware.ts):

- `/ui/*` routes are behind HTTP Basic auth (`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`).
- `/api/*` requests require the API token, sent as `Authorization: Bearer <token>` (`NEXT_PUBLIC_API_TOKEN`). API calls are made through the token-attaching helpers in `lib/api-client.browser.ts` (client code) and `lib/api-client.server.ts` (server code).

## Database

Postgres via [Prisma](https://www.prisma.io) (Rust-free `prisma-client` generator with the `@prisma/adapter-pg` driver adapter).

This project uses a **single shared database for both local development and production** (the Railway Postgres instance). We do **not** use Prisma migrations; the schema is pushed directly.

### Setup

1. Provision a Postgres database on Railway (Add service -> Database -> PostgreSQL). Railway sets `DATABASE_URL` on the `web` service automatically.
2. For local development, paste the same connection string into `DATABASE_URL` in your local `.env` (see [Configuration](#configuration) above).
3. Push the schema to the database (this updates the shared DB, i.e. production too):

```bash
npm run db:push
```

### Working with the schema

- Edit `prisma/schema.prisma`, then run `npm run db:push` to apply changes directly. There are no migration files.
- `npm run db:studio` opens Prisma Studio to browse/edit data.
- The Prisma client is generated into `lib/generated/` (gitignored, regenerated on `npm install`). Import it via the singleton: `import { prisma } from "@/lib/db"`.

> Note: because dev and prod share one database, `db:push` from your machine changes production. This is a deliberate proof-of-concept simplification; split the databases before real use.

The schema defines the models `GithubRepo`, `NpmPackage`, `AnalysisRun`, `AnalysisSubject`, and `AnalysisResult` (see `prisma/schema.prisma`). Use `npm run db:studio` to browse and edit the data directly.

Other scripts:

```bash
npm run build       # production build (Next standalone output)
npm run start       # run the production build locally
npm run lint        # eslint
npm run test        # run tests (vitest)
npm run test:watch  # run tests in watch mode
```

## Deployment overview

- The app builds into a self-contained server via Next.js `output: "standalone"` (see `next.config.ts`).
- The `Dockerfile` produces a small production image that runs `node server.js` and listens on `PORT` (Railway injects this automatically).
- Deploys are done manually from your machine with `railway up` (no GitHub auto-deploy is configured).

### One-time setup on the Railway web interface

Do this once at https://railway.com before your first deploy:

1. Create a new project named **`isitsketchy`** (New Project -> Empty Project).
2. Inside the project, add a service and rename it to **`web`**:
   - Click **New** -> **Empty Service**.
   - Open the service, go to **Settings** and set the service name to `web`.
3. (First deploy detail) Railway auto-detects the `Dockerfile` in this repo, so no build config is required. It sets the `PORT` environment variable automatically; the app already reads it.
4. After your first successful deploy, expose the app publicly:
   - Open the `web` service -> **Settings** -> **Networking** -> **Generate Domain**.
   - Choose the app's port (`3000`) if prompted. Railway then gives you a public `*.up.railway.app` URL.

### One-time setup on your machine

The Railway CLI is required. Install it if needed (see https://docs.railway.com/guides/cli):

```bash
# macOS (Homebrew)
brew install railway
```

Then authenticate and link this repo to the project/service:

```bash
railway login
railway link            # select the "isitsketchy" project, then the "web" service
```

`railway link` writes the association into `.railway` locally so subsequent commands target the right project/service.

### Push a deploy

From the repo root:

```bash
railway up --service web
```

This uploads the repo, builds the Docker image on Railway, and deploys it to the `web` service. The command streams build and deploy logs until the deploy finishes. Add `--detach` if you want it to return immediately without streaming.

### Tail logs

```bash
railway logs --service web                 # runtime (deploy) logs, streamed
railway logs --service web --build         # build logs for the latest deployment
```

You can also view logs in the Railway web UI under the `web` service -> **Deployments** -> select a deployment.

## Project structure

- `app/layout.tsx` - root layout wiring up Mantine (`MantineProvider`, `ColorSchemeScript`).
- `app/page.tsx` - redirects `/` to `/ui`.
- `app/ui/` - the pages: `page.tsx` (home), `analysis` and `analysis/[id]`, `signals`, `sources/github`, `sources/npm`.
- `app/api/` - route handlers: `analysis`, `sources/github`, `sources/npm`.
- `middleware.ts` - Basic auth for `/ui`, bearer-token auth for `/api`.
- `lib/` - `db.ts` (Prisma singleton), `api-client.browser.ts` / `api-client.server.ts` / `api-token.ts` (token-attaching API clients), `github.ts` / `npm.ts` (source clients), and `analysis/` (orchestrator and signals).
- `prisma/schema.prisma` - database models.
- `postcss.config.cjs` - PostCSS config required by Mantine.
- `Dockerfile` / `.dockerignore` - production container used by Railway.
- `next.config.ts` - Next.js config (`output: "standalone"`).
- `plan/` - the markdown files I used to plan this project with Claude (Opus 4.8 via Cursor; I'm old school and like working in an IDE).
- `transcripts/` - my AI transcripts from building the project.
