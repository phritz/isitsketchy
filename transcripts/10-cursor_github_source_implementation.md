# GitHub source implementation
_Exported on 7/1/2026 at 15:59:53 CDT from Cursor (3.9.16)_

---

**User**

we are going to implement @plan/sources-github.md . first remove the existing database table if any and the test pages that kicked its tires. add a link to the github cache management page from the home page. have a search box in the home page that accepts a github url and gets it, showing the metadata returned for now so we can see it work. be sure to use the new helper that was added to lib so authentication to api endpoints just works. any questions?

---

**Cursor**

Let me explore the current codebase structure.

Now let me explore the app structure, existing pages, and the Prisma schema.

Let me check env config and package.json.

Let me check for any other references to the existing `repos`/`Repo` and the test page.

I've got a clear picture. One thing genuinely blocks the "see it work" part: the plan requires an authenticated GitHub token (`GITHUB_TOKEN`), but there isn't one in `.env` or `.env.example` yet.

> **The plan treats a missing GitHub token as a misconfiguration (authenticated calls only). There's no GITHUB_TOKEN in .env yet. How should I handle it?**
> - I'll add a GITHUB_TOKEN to .env myself; you just wire the code to read it (Recommended)
> - Add GITHUB_TOKEN scaffolding to .env/.env.example and I'll paste the value in ✔
> - Skip the token for now and make unauthenticated GitHub calls (low rate limits)

> **How much of the plan should the first pass implement?**
> - Full plan: read-through GET + list + DELETE (one/all), rate limiters, root package.json fetch, and the /ui/sources/github management page (Recommended) ✔
> - Slim first pass: repo metadata only (no package.json fetch, no rate limiters yet), plus the management page

Got it. I have everything I need. Here's the plan.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll start implementing. Let me mark the first todo in progress and begin removing the old demo.

Now update the Prisma schema: remove `Repo`, add `GithubRepo`.

Now add `GITHUB_TOKEN` scaffolding to `.env.example` and `.env`.

Now apply the schema with `db:push`.

The `Repo` table has demo rows; dropping it is intended. Re-running with the data-loss flag.

Database synced. Now regenerate the Prisma client so `GithubRepo` is available.

Now the GitHub fetch layer. First the token reader.

Now the main GitHub fetch layer.

Now the client with types and functions.

Let me check what the generated Prisma client exports for JSON input typing.

Now the route.

Now the management UI page.

Now update the home page.

Now let me check for lint errors across the edited files and run the linter.

Two things: an eslint rule about synchronous setState in effects, and stale `.next` type artifacts referencing the deleted files. Let me fix the effect and clear the stale build cache.

Lint and typecheck pass. Let me do a runtime smoke test: start the dev server and exercise the endpoints.

Port 3000 is already in use (likely an existing dev server), and the sandbox is blocking network interface enumeration. Let me check existing terminals and test against whatever is already running.

My dev server hit a sandbox restriction (`uv_interface_addresses`), but there's already a server on port 3000 (pid 22793) that will hot-reload my changes. Let me kill my crashed instance and test against port 3000.

The server on port 3000 isn't our app (rejects our token). Let me start our own dev server outside the sandbox on a dedicated port to verify wiring.

The shell cwd drifted to the terminals folder. Let me start it in the project root.

The server is up. Let me exercise the endpoints and the read-through path.

Wiring is verified end to end: middleware auth, list, URL normalization/error mapping, and the read-through reaching GitHub (surfacing the expected 401 because the token is still the `change-me` placeholder). Let me stop the test server I started.

All done. Let me mark the final todo complete.

All todos are complete. Here's what I implemented for the GitHub source cache.

## What changed

**Removed the old demo**
- Deleted `app/api/repos/` (route + client) and `app/ui/test/page.tsx`.
- Removed the `Repo` model from `prisma/schema.prisma`, added `GithubRepo` (keyed by unique `url`, `data Json`, `fetchedAt`), and ran `db:push` (dropped the old table, created the new one) plus `prisma generate`.

**GitHub fetch layer**
- `lib/github-token.ts` — fail-fast reader for `GITHUB_TOKEN` (mirrors `lib/api-token.ts`).
- `lib/github.ts` — axios client to `api.github.com` with two module-level `RateLimiter` singletons (`github-core` 60/min used now, `github-search` 24/min reserved for the upcoming issue-count signals), URL normalization + owner/repo parsing, repo-metadata and root `package.json` fetch, and blob assembly (`schemaVersion`, `repo`, `packageJson`, `packageJsonMissing`). Typed `GithubFetchError` distinguishes `invalid_url` / `repo_not_found` from unexpected failures.

**API + client**
- `app/api/sources/github/route.ts` — `GET ?url` read-through (cache hit vs. fetch+store with `meta.cacheHit`), `GET` list, `DELETE ?id` / `?all=true`. `force-dynamic`, `no-store` headers, one top-level try/catch per handler.
- `app/api/sources/github/client.ts` — declared types and `getGithubRepo / listGithubRepos / deleteGithubRepo / clearGithubRepos`, all going through `browserApiClient` so the token attaches automatically.

**UI**
- `app/ui/sources/github/page.tsx` — cache management table with per-row Remove and Clear all.
- `app/page.tsx` + `app/home-search.tsx` — home page now links to the cache management page and has a URL search box that fetches a repo and renders the returned metadata.

**Env**
- Added `GITHUB_TOKEN` to `.env.example` and `.env` (placeholder `change-me`).

## Verification
- `npm run lint` and `npx tsc --noEmit` both pass (also fixed a `set-state-in-effect` lint on the management page).
- Ran the app and confirmed: list returns `{"ok":true,"data":[]}`, unauthenticated requests get 401, a bad URL returns `invalid_url`, and the read-through actually reaches GitHub (it currently returns a 401 from GitHub because the token is still the `change-me` placeholder — no row is stored on failure, as intended).

## One thing you need to do
Paste a real token into `GITHUB_TOKEN` in `.env` (public-repo read access is enough), then restart your dev server. After that, pasting e.g. `https://github.com/expressjs/express` on the home page will render the metadata, a second fetch will show `cacheHit: true`, and the entry will appear on `/ui/sources/github`. Note your currently-running server on port 3000 isn't this app (it rejected the `letmein` token), so make sure you restart the right one to pick up these changes.

---

**User**

<timestamp>Wednesday, Jul 1, 2026, 12:34 PM (UTC-5)</timestamp>
<system_notification>
The following task has notified. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: success
task_id: 398232:task_progress:1
title: dev server ready
detail: Shell output has pattern /Ready in|error|Error/. This is occurrence number 1. Matched text: Error. The title message is being displayed to the user.
output_path: /Users/fritz/.cursor/projects/Users-fritz-a-isitsketchy/terminals/398232.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed).</user_query>

<timestamp>Wednesday, Jul 1, 2026, 12:34 PM (UTC-5)</timestamp>
<system_notification>
The following task has notified. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: success
task_id: 398232:task_progress:2
title: dev server ready
detail: Shell output matched /Ready in|error|Error/ 6 more times since the previous notification. The title message is being displayed to the user. Latest match: error.
output_path: /Users/fritz/.cursor/projects/Users-fritz-a-isitsketchy/terminals/398232.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed).</user_query>

<timestamp>Wednesday, Jul 1, 2026, 12:34 PM (UTC-5)</timestamp>
<system_notification>
The following task has finished. If you were already aware, ignore this notification and do not restate prior responses.

<task>
kind: shell
status: aborted
task_id: 398232
title: Start Next dev server
output_path: /Users/fritz/.cursor/projects/Users-fritz-a-isitsketchy/terminals/398232.txt
</task>
</system_notification>
<user_query>Briefly inform the user about the task result and perform any follow-up actions (if needed).</user_query>

---

**Cursor**

These notifications are about the very first dev server I tried to start — it failed under the sandbox (the `uv_interface_addresses` error) and I already killed it, so no action is needed. I later ran a working test server on port 3007 (outside the sandbox), verified the endpoints, and shut it down cleanly.

No follow-up required. The implementation is complete and verified; the only remaining step on your end is pasting a real `GITHUB_TOKEN` into `.env` and restarting your own dev server.

---

**User**

so a classic PAT? 

---

**Cursor**

Yes, a classic PAT works and is the simplest option. For public repos you don't even need to check any scope boxes — an unscoped classic token still lifts you from 60 to 5,000 core requests/hour, which is all this cache needs (`GET /repos/...` and `/contents/package.json`).

Two options:

- **Classic PAT** (github.com/settings/tokens → "Tokens (classic)"): create one, leave all scopes unchecked, paste it into `GITHUB_TOKEN` in `.env`. If you ever want it to read private repos too, add the `repo` scope.
- **Fine-grained PAT** (works fine too): set "Repository access" to *Public repositories (read-only)*, no extra permissions needed.

Either one goes into `.env` as-is:

```
GITHUB_TOKEN="ghp_yourtokenhere"
```

Then restart your dev server so `lib/github-token.ts` picks it up. Note the token is server-only (no `NEXT_PUBLIC_` prefix), so it never ships to the browser.

---

**User**

kill the existing server on 3001

---

**Cursor**

Done — port 3001 is now free.

