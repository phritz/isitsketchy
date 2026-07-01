# Is It Sketchy

A tool that analyzes a JavaScript / npm package (and its backing GitHub repo) and reports signals about its trustworthiness — how "sketchy" it looks — so a developer can decide whether to depend on it.

## How it works (high level)

1. Take an npm package name.
2. Pull metadata from the npm registry, npm downloads API, GitHub, and deps.dev.
3. Compute a set of trust/risk signals from that data.
4. Present the signals (and eventually an aggregate score) to the user.

## Planning docs

- [Trustworthiness signals](./signals.md) — the signals we compute, their inputs, and exactly which REST API fields they come from (verified against live APIs).
