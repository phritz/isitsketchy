// SERVER-ONLY API client. Use this from server-side code (Route Handlers,
// Server Components, scripts) that runs in Node. Node cannot resolve relative
// URLs, so this client is configured with an absolute `baseURL` from
// `APP_BASE_URL`. Do NOT import it from browser code (`"use client"`) — use
// `lib/api-client.browser.ts` there instead.
//
// The token header is attached automatically from the single reader in
// `lib/api-token.ts`.
import axios, { type AxiosInstance } from "axios";
import { API_TOKEN } from "@/lib/api-token";

const baseURL: string | undefined = process.env.APP_BASE_URL;

if (!baseURL) {
  throw new Error(
    "APP_BASE_URL is not set. The server-side API client needs an absolute base URL (see .env.example).",
  );
}

export const serverApiClient: AxiosInstance = axios.create({
  baseURL,
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
  },
});
