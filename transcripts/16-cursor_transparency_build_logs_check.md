# Transparency build logs check
_Exported on 7/1/2026 at 16:01:14 CDT from Cursor (3.9.16)_

---

**User**

re @plan/signals.md , is it easy to add a check whether a repo and / or package has transparency build logs?

---

**Cursor**

Short answer: **yes for npm packages (it's basically already scoped in your plan), and mostly no for GitHub repos** — there's no clean per-repo API for it.

Here's the reasoning, grounded in what you already have.

## What "transparency build log" maps to here

In supply-chain terms this is Sigstore/Rekor-backed **build provenance** (SLSA provenance attestations recorded in a public transparency log). Your [signals.md](plan/signals.md) already captures the npm side of exactly this as a "Nice to have":

```57:57:plan/signals.md
| Sigstore provenance / attestations | Easy-ish (nice to have) | npm registry | `GET /-/npm/v1/attestations/{pkg}@{version}` | `attestations[]` with `predicateType`s `.../npm/attestation/.../publish/v0.1` and `https://slsa.dev/provenance/v1`. ...
```

## npm packages — easy

Two reasons it's cheap:

- **Presence is a single field on the packument you already cache.** Provenance-published packages have `versions[latest].dist.attestations = { url, provenance: { predicateType } }`. Your npm source blob already plans to store `dist (tarball, integrity, signatures/provenance if present)` (see [sources-npm.md](plan/sources-npm.md) Cached Shape), so a `PACKAGE_SIGNALS` entry can compute from the cached blob with **no extra fetch** — green if `dist.attestations` present, red/yellow if absent.
- **The transparency-log detail** (Rekor entry, source repo, GitHub Actions workflow) lives in the attestation predicate at `dist.attestations.url` (the `/-/npm/v1/attestations/...` endpoint). One optional extra GET if you want to show *which* build/workflow, or to cross-check that the attested `sourceRepo` matches the package's self-reported `repository.url` (a genuinely strong trust signal).

This fits your architecture with essentially zero new plumbing: one entry in `PACKAGE_SIGNALS` in [lib/analysis/signals.ts](lib/analysis/signals.ts), reading `ctx.npmPackage`.

## GitHub repos — not easy / not clean

There's no REST endpoint that answers "does this repo have transparency build logs" for a repo as a whole:

- GitHub **Artifact Attestations** (`GET /repos/{o}/{r}/attestations/{subject_digest}`) are keyed by an artifact's content digest — you'd need a specific built artifact hash, which you don't have for an arbitrary repo.
- Rekor (`rekor.sigstore.dev`) is searchable, but by artifact hash or signing identity, not by "repo has any build logs."
- The only tractable repo-level approximations are indirect: infer it **from the npm side** (the npm provenance predicate points back to `owner/repo` + the `.github/workflows` file that built it), or scan `.github/workflows` for SLSA/provenance generators — both heuristic and more work.

So the practical recommendation: **add it as one npm package signal ("build provenance present"), and treat the repo answer as a derived consistency check off the npm attestation rather than a standalone repo signal.**

Want me to turn this into a concrete plan (the `package_provenance` signal + optional attestation cross-check), or were you just gauging feasibility?

