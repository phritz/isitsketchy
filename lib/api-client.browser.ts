// BROWSER-ONLY API client. Use this from Client Components (`"use client"`) and
// other code that runs in the browser. It relies on relative URLs, which the
// browser resolves against the current origin, so do NOT import it from
// server-side code (Node has no origin to resolve `/api/...` against — use
// `lib/api-client.server.ts` there instead).
//
// The token header is attached automatically from the single reader in
// `lib/api-token.ts`.
import axios, { type AxiosInstance } from "axios";
import { API_TOKEN } from "@/lib/api-token";

// Our own endpoints are quick DB-backed operations (poll a run, list runs,
// create-and-return-id with detached orchestration), so a 10s timeout is a safe
// upper bound that fails fast instead of hanging the UI. The analysis page's
// poll loop tolerates a timed-out request and keeps polling.
const REQUEST_TIMEOUT_MS: number = 10000;

export const browserApiClient: AxiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
  },
});
