// Shared error helpers used by every endpoint's client and route handler.
//
// `ErrorResponse` is the single `{ ok: false, error }` body shape our API
// returns on failure. `toError` unwraps that shape from an axios error so the
// browser surfaces the server's message; `errorMessage` extracts a message from
// an unknown thrown value with a safe fallback.
import { AxiosError } from "axios";

export type ErrorResponse = {
  ok: false;
  error: { message: string };
};

// Surface the server's `{ ok: false, error }` message instead of a generic
// axios status string.
export function toError(error: unknown): Error {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ErrorResponse | undefined;
    if (data && data.ok === false) {
      return new Error(data.error.message);
    }
  }
  return error instanceof Error ? error : new Error("Request failed");
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
