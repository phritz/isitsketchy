import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type {
  CreateRepoRequest,
  CreateRepoResponse,
  ErrorResponse,
  ListReposResponse,
  Repo,
} from "./client";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function serialize(repo: {
  id: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}): Repo {
  return {
    id: repo.id,
    url: repo.url,
    createdAt: repo.createdAt.toISOString(),
    updatedAt: repo.updatedAt.toISOString(),
  };
}

export async function GET(): Promise<NextResponse<ListReposResponse | ErrorResponse>> {
  try {
    const repos = await prisma.repo.findMany({ orderBy: { createdAt: "desc" } });
    const body: ListReposResponse = { ok: true, data: repos.map(serialize) };
    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const body: ErrorResponse = { ok: false, error: { message } };
    return NextResponse.json(body, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<CreateRepoResponse | ErrorResponse>> {
  try {
    const input = (await request.json()) as CreateRepoRequest;
    const url = typeof input.url === "string" ? input.url.trim() : "";
    if (url.length === 0) {
      const body: ErrorResponse = { ok: false, error: { message: "url is required" } };
      return NextResponse.json(body, { status: 400, headers: NO_STORE_HEADERS });
    }
    const repo = await prisma.repo.create({ data: { url } });
    const body: CreateRepoResponse = { ok: true, data: serialize(repo) };
    return NextResponse.json(body, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const body: ErrorResponse = { ok: false, error: { message } };
    return NextResponse.json(body, { status: 500, headers: NO_STORE_HEADERS });
  }
}
