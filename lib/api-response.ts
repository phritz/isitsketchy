// Shared server-side response helpers for API route handlers.
//
// SERVER-ONLY (imports next/server). Per AGENTS.md every endpoint forces dynamic
// rendering and returns no-store headers; these are the shared building blocks
// so each `route.ts` does not redeclare them.
import { NextResponse } from "next/server";
import type { ErrorResponse } from "@/lib/errors";

export const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export function errorResponse(
  message: string,
  status: number,
): NextResponse<ErrorResponse> {
  const body: ErrorResponse = { ok: false, error: { message } };
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}
