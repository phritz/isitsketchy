# Trustworthiness Signals

Signals we compute for an npm package to judge how "sketchy" it is, and exactly where each input comes from in a REST API. All endpoints below were verified against the live APIs.

## APIs used

| Alias | Base URL | Auth | Notes |
| --- | --- | --- | --- |
| npm registry | `https://registry.npmjs.org` | none | Full packument (`GET /{pkg}`) has `time`, `maintainers`, `versions[v].scripts`, `repository`. |
| npm downloads | `https://api.npmjs.org/downloads` | none | Point + range download counts. |
| GitHub | `https://api.github.com` | token recommended | Unauth = 60 req/hr; authed = 5000/hr. Search API is separate: 10 req/min unauth, 30/min authed. |
| deps.dev | `https://api.deps.dev/v3alpha` | none | Google Open Source Insights. Only reliable free source for npm dependents. |

**Linking npm → GitHub:** most GitHub signals require first reading `versions[latest].repository.url` from the npm packument (e.g. `git+https://github.com/expressjs/express.git`) and normalizing it to `owner/repo`. This can be missing, wrong, or point to a non-GitHub host — treat "no resolvable repo" as its own (mildly sketchy) signal.

## Signals

| Signal | Difficulty | Source | Endpoint | Field / how to derive |
| --- | --- | --- | --- | --- |
| npm package age | Easy | npm registry | `GET /{pkg}` | `time.created` (first-ever publish). Age = now − created. |
| Age of latest publish | Easy | npm registry | `GET /{pkg}` | `time[dist-tags.latest]` (exact version publish time) or `time.modified` (any change). |
| npm maintainers count | Easy | npm registry | `GET /{pkg}` | `maintainers[]` length. Note: this is the npm publish ACL, not real humans. |
| Install hooks present | Easy | npm registry | `GET /{pkg}` | `versions[latest].scripts` — check for `preinstall` / `install` / `postinstall` keys. Present in the full packument (verified on `express`). Strongest single sketchiness signal. |
| npm downloads | Easy | npm downloads | `GET /downloads/point/last-month/{pkg}` | `.downloads` (integer). Range endpoint `/downloads/range/last-week/{pkg}` gives per-day for trend/anomaly detection. |
| GitHub repo age | Easy | GitHub | `GET /repos/{o}/{r}` | `created_at`. |
| GitHub stars | Easy | GitHub | `GET /repos/{o}/{r}` | `stargazers_count`. |
| Last push / activity | Easy | GitHub | `GET /repos/{o}/{r}` | `pushed_at` (cheap staleness proxy; 1 request). |
| Commits in last month | Medium | GitHub | `GET /repos/{o}/{r}/commits?since={ISO}&per_page=1` | Read the `Link` header, parse `rel="last"` page number = commit count (each page = 1 commit). Alternative: `GET /repos/{o}/{r}/stats/commit_activity` returns 52 weeks of `{week,total}` in one call (but is async — may 202 on first hit). |
| Open vs closed issues | Medium | GitHub Search | `GET /search/issues?q=repo:{o}/{r}+type:issue+state:open` and `...state:closed` | `total_count` from each. `type:issue` excludes PRs (the repo object's `open_issues_count` wrongly includes PRs). Watch the 10/min search rate limit. |
| Latest issue closed | Medium | GitHub Search | `GET /search/issues?q=repo:{o}/{r}+type:issue+state:closed&sort=updated&order=desc&per_page=1` | `items[0].closed_at`. (Don't use REST `/issues` — it mixes in PRs; verified all 5 recent "closed issues" on express were actually PRs.) Search can only sort by `updated`, which is a close enough proxy for closed order. |
| GitHub contributor count | Medium | GitHub | `GET /repos/{o}/{r}/contributors?per_page=1&anon=true` | `Link` header `rel="last"` page number = contributor count. This is contributors, a proxy for "maintainers". True maintainers = `GET /repos/{o}/{r}/collaborators`, but that requires push access (auth), so not usable for arbitrary repos. |
| Incoming dependents | Medium (needs deps.dev) | deps.dev | `GET /systems/npm/packages/{pkg}/versions/{v}:dependents` | `dependentCount`, `directDependentCount`, `indirectDependentCount`. npm itself has **no** official dependents API and the npmjs.com "dependents" page is not scrape-friendly, so deps.dev is the practical source. Requires a specific version in the path. |

## Complexity at a glance

- **Easy (single request, no auth):** npm package age, latest publish age, npm maintainers, install hooks, downloads, repo age, stars, last push. All come from one npm packument call plus one GitHub repo call plus the downloads endpoint.
- **Medium (pagination tricks or Search API):** commits in last month, open vs closed issues, latest issue closed, GitHub contributor count, incoming dependents (needs deps.dev).
- **Main bottleneck:** GitHub Search rate limits (10 req/min unauth, 30/min authed) dominate. Batch/cache issue counts; a token helps; GraphQL could fetch repo fields + open/closed issue counts in one query (worth exploring later).
- **Key caveat:** every GitHub signal depends on resolving the self-reported npm `repository.url` to `owner/repo`. Missing/wrong/foreign-host repo is itself a sketchiness signal.

## Getting the package: registry metadata vs tarball vs GitHub

Is there a better source than `package.json` for what actually runs? **No — the npm-published tarball is the source of truth, and GitHub is not a substitute.**

- The registry `versions[v].scripts` field is derived from the `package.json` inside the **published tarball** (`versions[v].dist.tarball`), which is exactly what `npm install` executes. Cheap and correct for the hooks signal — no download needed.
- **GitHub releases / repo source are a different artifact.** The npm tarball can diverge from the repo, and many packages don't attach the tarball to GH releases. So GH release info is not authoritative for "what gets installed" — and it's worse for the hooks signal.
- For deeper inspection, download `dist.tarball` and read the real `package.json` + scan for obfuscated code / binaries invoked from lifecycle scripts.
- The packument also exposes integrity/provenance we can use as signals:
  - `dist.integrity` + `dist.shasum` — content hashes.
  - `dist.signatures` — npm registry signing.
  - `--provenance` attestations (Sigstore) tie the tarball to a specific CI build; "does published code match the repo?" and "has provenance?" are strong trust signals to add later.

## Nice to have

| Signal | Difficulty | Source | Endpoint | Field / how to derive |
| --- | --- | --- | --- | --- |
| Sigstore provenance / attestations | Easy-ish (nice to have) | npm registry | `GET /-/npm/v1/attestations/{pkg}@{version}` | `attestations[]` with `predicateType`s `.../npm/attestation/.../publish/v0.1` and `https://slsa.dev/provenance/v1`. Present only for packages published with `--provenance`; ties the tarball to a specific GitHub Actions build via Sigstore. `404` = no provenance, which is itself a mild "less verifiable" signal. Verified: present on `sigstore@2.3.1`, absent (404) on `express@5.2.1`. Full trust would also verify the Sigstore signatures, but reading presence + the source repo/workflow in the predicate is a good first pass. |

## Notes / open questions

- **Version to use for deps.dev / hooks:** default to `dist-tags.latest`. Consider also checking the most-downloaded version.
- **Search API rate limits** (10/min unauth) will dominate. Batch/cache issue counts; a GitHub token raises this to 30/min. GraphQL could fetch issue open/closed counts + repo fields in one query and is worth exploring later.
- **npm → repo trust:** the `repository` field is self-reported and unverified. A package pointing at a popular repo it doesn't own is itself a sketchiness signal worth flagging later.
- **Not pursued (hard):** verified provenance/attestations, real human maintainer identity, typosquat/name-similarity — deferred.
