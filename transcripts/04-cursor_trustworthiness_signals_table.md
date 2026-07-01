# Trustworthiness signals table
_Exported on 7/1/2026 at 15:57:49 CDT from Cursor (3.9.16)_

---

**User**

we are building an app called is it sketchy. its going to analyze js npm repo and package for signals about trustworthiness. lets create a list of signals that we want to compute and the inputs they rely on, and where they are available in the github or npm registry api. here are some signals that i think are worth including:
- npm package age (how long has this package been around)
- github repo age
- stars on github repo
- downloads of npm package
- number of commits to repo in last month
- age of latest npm package published
- incoming dependency counts for npm package 
- number of open vs closed issues
- when was latest issue closed
- number of maintainers (for github and npm)
- does npm package have preinstall, install, or postinstall hooks

i'm not sure how easy these are to get, or what fields they come from in teh api. you task is to create a simple table that shows how we can get this data from the rest apis of github and npm. saying not sure or its hard is fine, we dont need all these signals. feel free to install skills for github and npm rest apis if available. 


---

**Cursor**

I'll start by looking at the existing project structure to understand where to put this.

No `plan/` folder yet. There are no GitHub/npm API skills available in the skill list (only Cursor and Firecrawl skills), so I'll verify the API details directly against the live APIs to make the table accurate. Let me probe a few endpoints for the uncertain signals.

npm confirmed. Now let me probe the GitHub endpoints for the trickier signals (commit counts, issue splits, latest closed issue, contributors).

Now let me check the one genuinely hard signal — incoming dependents — since npm has no official endpoint. I'll test Google's deps.dev API as an alternative.

deps.dev's `v3alpha` gives dependents counts. I now have everything verified. Let me write the plan file.

Done. I verified every endpoint against the live npm and GitHub APIs (using `express` as a test package) and wrote it up in `plan/signals.md`. Here's the summary.

## What's easy (single npm request)
From one call to `GET https://registry.npmjs.org/{pkg}`:
- **npm package age** → `time.created`
- **latest publish age** → `time[dist-tags.latest]`
- **npm maintainers** → `maintainers[]` length
- **install hooks** → `versions[latest].scripts` has `preinstall`/`install`/`postinstall` (confirmed present in the full packument — this is probably your strongest signal)

Plus **downloads** (`api.npmjs.org/downloads/point/last-month/{pkg}`) and, from one GitHub repo call, **repo age** (`created_at`), **stars** (`stargazers_count`), and last-push staleness (`pushed_at`).

## What's medium (pagination tricks / search API)
- **Commits last month** → hit `/commits?since=…&per_page=1` and read the `Link` header's `rel="last"` page number = count.
- **Open vs closed issues** → GitHub Search `total_count` with `type:issue` (the repo's `open_issues_count` wrongly counts PRs).
- **Latest closed issue** → Search sorted by `updated` desc; don't use REST `/issues` because it mixes in PRs (I confirmed express's 5 most recent "closed issues" there were all PRs).
- **Contributor count** → same `Link`-header trick on `/contributors`. True maintainers (`/collaborators`) needs push access, so contributors is the usable proxy.

## The one that needed a workaround
- **Incoming dependents** → npm has no official API for this. But Google's **deps.dev** does: `GET https://api.deps.dev/v3alpha/systems/npm/packages/{pkg}/versions/{v}:dependents` returned `dependentCount`, `directDependentCount`, `indirectDependentCount` (express: ~77.9k). Note it's `v3alpha` and needs a specific version in the path.

## Two caveats worth flagging now
1. **npm→GitHub linking**: all GitHub signals depend on parsing the self-reported `repository.url`. It can be missing/wrong — I treated "no resolvable repo" as its own sketchiness signal.
2. **Search rate limits** (10/min unauth, 30/min with a token) will be your bottleneck; worth caching or moving issue counts to GraphQL later.

Full table with exact fields is in `plan/signals.md`. Want me to sketch the `client.ts` types/endpoints for fetching these next?

---

**User**

- ensure the complexity details above are in the doc you created
- link the signals doc from plan/project.md
- is there a better way to get the npm package other than package.json? maybe github release info?

---

**Cursor**

The complexity details and caveats are already in the doc (Difficulty column + Notes section), but I'll add a compact "complexity at a glance" summary so it's explicit. I'll also add a section answering the package-source question, and create `plan/project.md` linking the signals doc.

On your third question — short answer: **no, GitHub release info is not a better source, and it's arguably worse.** Details:

- The `scripts` we read from the registry packument is derived from the `package.json` inside the **published npm tarball**, which is the artifact that actually runs on `npm install`. GitHub source / releases are a *different* artifact — the npm tarball can (and for sketchy packages, often does) diverge from the repo. Many packages don't even attach the npm tarball to GitHub releases.
- So the registry `scripts` field is the cheap, correct source for the hooks signal (no download needed).
- If we want to go deeper/authoritative, the source of truth is `versions[v].dist.tarball` — download and inspect the real `package.json` plus look for obfuscated code/binaries in lifecycle scripts.
- The interesting bonus: the packument already exposes `dist.integrity`, `dist.signatures` (registry signing), and (for packages published with `--provenance`) Sigstore **attestations** linking the tarball back to a specific GitHub Actions build. "Does the published code match the repo?" and "has provenance?" are strong sketchiness signals in their own right.

Let me make the edits.

All three done:

1. **Complexity details are now in the doc** — added a "Complexity at a glance" section to `plan/signals.md` (Easy vs Medium grouping, the Search-API rate-limit bottleneck, and the npm→repo resolution caveat), on top of the existing Difficulty column.

2. **Linked from `plan/project.md`** — created the project overview and linked the signals doc under a "Planning docs" section.

3. **Package-source question** — answered above and captured it in a new "Getting the package: registry metadata vs tarball vs GitHub" section. Bottom line: the npm **tarball** (`dist.tarball`) is the source of truth for what actually installs; GitHub releases are a different, non-authoritative artifact. The registry `scripts` field is fine and cheap for the hooks signal, and the packument also gives us `dist.integrity`, `dist.signatures`, and Sigstore provenance/attestations as extra trust signals to add later.

---

**User**

- add sigstore attestattion to plan/@plan/signals.md  as a nice to have. 
- let's talk about whether the entrypoint should be an npm package (which requires finding the associated github repos) or a github repo (which requires finding the associated npm package). starting with a github repo is more ergonomic but i want to go with whatever is going to have the highest likelihood of success. what do you think?

---

**Cursor**

Let me verify the npm attestation/provenance endpoint so I document it accurately.

Verified: `GET https://registry.npmjs.org/-/npm/v1/attestations/{pkg}@{version}` returns the npm publish attestation + SLSA provenance for packages published with `--provenance` (tested `sigstore@2.3.1`); `express` returns `404` (no provenance — itself a mild signal). Adding it as a nice-to-have.

Added. Now to your entrypoint question.

## Recommendation: make the **npm package** the canonical key, but accept a GitHub URL as a convenience input

The ergonomic win of starting from a GitHub repo is real, but it fights the grain of both the threat model and the data. I'd key everything on the npm package internally, while letting the UI accept either.

### Why npm is the higher-success-rate key

**1. It matches the actual threat model.** "Is it sketchy?" is really "should I `npm install` this?" The risky act is installing a package, and the highest-signal data is npm-side: install hooks, download counts, publish cadence, dependents, provenance. Given a package name, all of those are *always* available. Given only a repo, you can't check the artifact that actually runs until you find its package — and it might not have one.

**2. npm → GitHub resolution degrades gracefully.** It's a single self-reported field (`repository.url`). When it's present (the common case) you get everything; when it's missing/wrong/foreign-host, you still have the full npm signal set, and the failure is itself a sketchiness signal. You never end up with nothing.

**3. GitHub → npm resolution is genuinely ambiguous and can fail hard:**
- A repo may publish **0** packages (not on npm at all) → you lose every npm signal, i.e. most of the product.
- A repo may publish **many** (monorepos like Babel, `@aws-sdk/*`) → "which package?" has no clean answer.
- The published name often differs from the repo name, and the published tarball can diverge from the repo — so you'd have to read `package.json` in the repo and then still verify against npm.

So npm→repo fails *soft* (lose some GitHub signals), while repo→npm fails *hard* (lose the core npm signals, or hit ambiguity).

### The part you should do regardless of entrypoint

Do a **bidirectional check**: confirm the npm `repository.url` points at the repo *and* that repo's `package.json` `name` matches the package. Agreement raises confidence; mismatch (package claiming a popular repo it doesn't actually own) is a strong sketchiness signal. This is the same linking work either way — it just runs in a different direction.

### Concrete proposal
- **Internal identity = npm package name (+ version).**
- **Input accepts:** a package name, an npm URL, *or* a GitHub URL.
- If a GitHub URL is given, resolve it to candidate npm package(s) by reading `package.json`(s) in the repo, then verify each candidate's `repository.url` points back. If 0 → report "no published npm package found" (and can only offer GitHub-side signals). If >1 → let the user pick.

Net: you get the GitHub ergonomics you want at the input layer without betting the analysis on the fragile direction.

Want me to record this decision in `plan/project.md`?

---

**User**

no i want to keep this demo ergnomic and i want to have github links as the entrypoint. we are primarily concerned about whether a projects DEPENDENCIES are sketchy. so let's use the package.json from a github link and then do the npm analysis on its depenendencies. we can later add an optional way to start with the npm package, will be easy after we have all the above.

---

**Cursor**

Got it — that reframes the flow nicely: the GitHub repo is the *project under evaluation*, and the sketchiness analysis runs on each of its npm **dependencies**. Let me record that in `plan/project.md`.

Done. Updated `plan/project.md` to reflect the flow: **GitHub link → read its `package.json` → analyze each npm dependency** with the signals in `signals.md`, with the npm-package entrypoint noted as an easy later add-on.

Note the signals doc needs no changes — it's already framed per-npm-package, which is exactly what each dependency is (and the npm→GitHub resolution now just runs per-dependency instead of once).

Two decisions worth pinning down when you're ready (I listed them under "Open questions / later" in `project.md`):
- **Which deps to scan** — direct `dependencies` only, or also `devDependencies`/`peer`/`optional`? And direct-only vs transitive (via lockfile)?
- **Which version per dependency** — the range in `package.json`, the resolved lockfile version, or `dist-tags.latest`?

For a clean demo I'd suggest starting with **direct `dependencies` + `devDependencies`, analyzing `dist-tags.latest`** — simplest and no lockfile parsing — then add transitive/lockfile resolution later. Want me to bake that default into the doc?

---

**User**

for now we want to scan all direct dependencies, we will do the transitive set later. include dev/peer/optional. yes dist-tags.latest. bake this into the doc

---

**Cursor**

Baked in. `plan/project.md` now records the decided scope:

- **Scan all direct deps** across `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`.
- **Analyze `dist-tags.latest`** per dependency (no lockfile/range parsing for now).
- Transitive deps, exact-version resolution, and the optional npm-package entrypoint are all noted under "Later".

