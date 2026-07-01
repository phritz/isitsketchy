import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  fetchGithubRepoData,
  GithubFetchError,
  normalizeUrl,
  type GithubRepoData,
} from "@/lib/github";
import { errorMessage } from "@/lib/errors";
import { errorResponse, NO_STORE_HEADERS } from "@/lib/api-response";
import type {
  ErrorResponse,
  GithubRepoResponse,
  GithubRepoSummary,
  ListGithubReposResponse,
} from "./client";

export const dynamic = "force-dynamic";

type GithubRepoRow = {
  id: string;
  url: string;
  data: Prisma.JsonValue;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function serializeSummary(row: GithubRepoRow): GithubRepoSummary {
  return {
    id: row.id,
    url: row.url,
    fetchedAt: row.fetchedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readThrough(
  url: string,
): Promise<NextResponse<GithubRepoResponse | ErrorResponse>> {
  const normalized: string = normalizeUrl(url);

  const existing = await prisma.githubRepo.findUnique({
    where: { url: normalized },
  });
  if (existing) {
    const body: GithubRepoResponse = {
      ok: true,
      data: existing.data as unknown as GithubRepoData,
      meta: { fetchedAt: existing.fetchedAt.toISOString(), cacheHit: true },
    };
    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  }

  const data: GithubRepoData = await fetchGithubRepoData(normalized);
  const fetchedAt: Date = new Date();
  const created = await prisma.githubRepo.create({
    data: {
      url: normalized,
      data: data as unknown as Prisma.InputJsonValue,
      fetchedAt,
    },
  });
  const body: GithubRepoResponse = {
    ok: true,
    data,
    meta: { fetchedAt: created.fetchedAt.toISOString(), cacheHit: false },
  };
  return NextResponse.json(body, { headers: NO_STORE_HEADERS });
}

async function listAll(): Promise<NextResponse<ListGithubReposResponse>> {
  const rows = await prisma.githubRepo.findMany({
    orderBy: { fetchedAt: "desc" },
  });
  const body: ListGithubReposResponse = {
    ok: true,
    data: rows.map(serializeSummary),
  };
  return NextResponse.json(body, { headers: NO_STORE_HEADERS });
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<GithubRepoResponse | ListGithubReposResponse | ErrorResponse>> {
  try {
    const url: string | null = request.nextUrl.searchParams.get("url");
    if (url && url.trim().length > 0) {
      return await readThrough(url.trim());
    }
    return await listAll();
  } catch (error) {
    if (error instanceof GithubFetchError) {
      return errorResponse(error.code, error.status);
    }
    return errorResponse(errorMessage(error), 500);
  }
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse<{ ok: true } | ErrorResponse>> {
  try {
    const params: URLSearchParams = request.nextUrl.searchParams;
    if (params.get("all") === "true") {
      await prisma.githubRepo.deleteMany({});
      return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
    }

    const id: string | null = params.get("id");
    if (!id || id.trim().length === 0) {
      return errorResponse("id or all=true is required", 400);
    }
    await prisma.githubRepo.delete({ where: { id: id.trim() } });
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return errorResponse(errorMessage(error), 500);
  }
}
