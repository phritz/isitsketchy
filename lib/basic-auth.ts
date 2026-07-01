// The single source of truth for the /ui HTTP Basic auth credentials.
//
// This is the ONLY place these are read from the environment. The middleware
// imports from here to validate incoming /ui requests. Values are read at
// module load time and throw immediately if absent, so a misconfigured deploy
// fails fast instead of silently allowing (or blocking) all access.
const user: string | undefined = process.env.BASIC_AUTH_USER;
const password: string | undefined = process.env.BASIC_AUTH_PASSWORD;

if (!user) {
  throw new Error(
    "BASIC_AUTH_USER is not set. Add it to your environment (see .env.example).",
  );
}

if (!password) {
  throw new Error(
    "BASIC_AUTH_PASSWORD is not set. Add it to your environment (see .env.example).",
  );
}

export const BASIC_AUTH_USER: string = user;
export const BASIC_AUTH_PASSWORD: string = password;
