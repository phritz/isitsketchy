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

export const browserApiClient: AxiosInstance = axios.create({
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
  },
});
