import { NextRequest, NextResponse } from "next/server";
import { API_TOKEN } from "@/lib/api-token";
import { BASIC_AUTH_PASSWORD, BASIC_AUTH_USER } from "@/lib/basic-auth";

function unauthorizedBasic(): NextResponse {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="isitsketchy"' },
  });
}

function unauthorizedApi(): NextResponse {
  return NextResponse.json(
    { ok: false, error: { message: "Unauthorized" } },
    { status: 401 },
  );
}

function isValidBasicAuth(header: string | null): boolean {
  if (!header || !header.startsWith("Basic ")) {
    return false;
  }
  const decoded: string = atob(header.slice("Basic ".length));
  const separator: number = decoded.indexOf(":");
  if (separator === -1) {
    return false;
  }
  const user: string = decoded.slice(0, separator);
  const password: string = decoded.slice(separator + 1);
  return user === BASIC_AUTH_USER && password === BASIC_AUTH_PASSWORD;
}

function isValidApiToken(header: string | null): boolean {
  if (!header || !header.startsWith("Bearer ")) {
    return false;
  }
  return header.slice("Bearer ".length) === API_TOKEN;
}

export function middleware(request: NextRequest): NextResponse {
  const pathname: string = request.nextUrl.pathname;
  const authHeader: string | null = request.headers.get("authorization");

  if (pathname.startsWith("/api")) {
    if (!isValidApiToken(authHeader)) {
      return unauthorizedApi();
    }
    return NextResponse.next();
  }

  if (!isValidBasicAuth(authHeader)) {
    return unauthorizedBasic();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/ui/:path*", "/api/:path*"],
};
