# Is It Sketchy?

A [Next.js](https://nextjs.org) (App Router, TypeScript) app using [Mantine](https://mantine.dev) for UI. It is deployed to [Railway](https://railway.com) as a Docker image via the Railway CLI.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts:

```bash
npm run build   # production build (Next standalone output)
npm run start   # run the production build locally
npm run lint    # eslint
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
- `app/page.tsx` - the home page.
- `postcss.config.cjs` - PostCSS config required by Mantine.
- `Dockerfile` / `.dockerignore` - production container used by Railway.
- `next.config.ts` - Next.js config (`output: "standalone"`).
