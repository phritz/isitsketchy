# Is It Sketchy

A tool that answers: **are a project's dependencies sketchy?** You give it a GitHub repo, and it analyzes each of the repo's npm dependencies for trustworthiness signals — how "sketchy" each one looks — so you can decide whether the project is safe to depend on.

## Entrypoint: GitHub link

The entrypoint is a **GitHub repo link** (chosen for ergonomics). The repo is the *project under evaluation*; the sketchiness analysis runs on its **dependencies**, not the repo itself.

- Later we can add an optional npm-package entrypoint. It'll be easy once the pipeline below exists (it just skips step 1).

## Scope (decided)

- **Dependencies scanned:** all **direct** dependencies — `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`. Transitive dependencies come later.
- **Version analyzed per dependency:** `dist-tags.latest` (ignore the range in `package.json` for now — no lockfile parsing).

## How it works (high level)

1. Take a GitHub repo link and read its `package.json`, collecting all direct deps across `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`.
2. For each dependency (an npm package), analyze its `dist-tags.latest` version: pull metadata from the npm registry, npm downloads API, deps.dev, and — via each dependency's own `repository.url` — GitHub.
3. Compute the trust/risk signals for each dependency.
4. Present per-dependency signals (and eventually an aggregate project score) to the user.

## Later

- Transitive dependencies (via lockfile).
- Analyzing the exact resolved/ranged version instead of `dist-tags.latest`.
- Optional npm-package entrypoint (skips step 1).

## Planning docs

- [Trustworthiness signals](./signals.md) — the signals we compute, their inputs, and exactly which REST API fields they come from (verified against live APIs).
