// The single source of truth for the GitHub API token.
//
// The GitHub source component treats a missing token as a misconfiguration:
// unauthenticated GitHub is only 60 core req/hr (vs. 5000/hr authenticated),
// which is not viable for this workload. This is server-only (no NEXT_PUBLIC_
// prefix): it must never be shipped to the browser.
//
// Read lazily (not at module load) so importing this file during the Next.js
// build's "collecting page data" step does not require the token. Build
// environments (e.g. Railway) typically do not inject runtime env vars, so an
// eager read would fail the build. We still fail fast on the first request.
export function getGithubToken(): string {
  const raw: string | undefined = process.env.GITHUB_TOKEN;
  if (!raw) {
    throw new Error(
      "GITHUB_TOKEN is not set. Add it to your environment (see .env.example).",
    );
  }
  return raw;
}
