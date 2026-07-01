// The single source of truth for the API auth token.
//
// This is the ONLY place the token is read from the environment. Both sides of
// an API call import from here:
//   - the client helper (lib/api-client.ts) attaches it as a Bearer header
//   - the middleware (middleware.ts) validates it on incoming /api requests
//
// It is read at module load time and throws immediately if absent, so a
// misconfigured deploy fails fast instead of silently allowing unauthenticated
// requests. NEXT_PUBLIC_ is required because the internal API clients run in the
// browser; the value is inlined into the client bundle (behind /ui basic auth).
const raw: string | undefined = process.env.NEXT_PUBLIC_API_TOKEN;

if (!raw) {
  throw new Error(
    "NEXT_PUBLIC_API_TOKEN is not set. Add it to your environment (see .env.example).",
  );
}

export const API_TOKEN: string = raw;
