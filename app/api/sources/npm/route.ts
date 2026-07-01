import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  fetchNpmPackageData,
  NpmFetchError,
  type NpmPackageData,
} from "@/lib/npm";
import type {
  ErrorResponse,
  ListNpmPackagesResponse,
  NpmPackageResponse,
  NpmPackageSummary,
} from "./client";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

type NpmPackageRow = {
  id: string;
  name: string;
  data: Prisma.JsonValue;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function serializeSummary(row: NpmPackageRow): NpmPackageSummary {
  return {
    id: row.id,
    name: row.name,
    fetchedAt: row.fetchedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function errorResponse(
  message: string,
  status: number,
): NextResponse<ErrorResponse> {
  const body: ErrorResponse = { ok: false, error: { message } };
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function readThrough(
  name: string,
): Promise<NextResponse<NpmPackageResponse | ErrorResponse>> {
  const existing = await prisma.npmPackage.findUnique({
    where: { name },
  });
  if (existing) {
    const body: NpmPackageResponse = {
      ok: true,
      data: existing.data as unknown as NpmPackageData,
      meta: { fetchedAt: existing.fetchedAt.toISOString(), cacheHit: true },
    };
    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  }

  const data: NpmPackageData = await fetchNpmPackageData(name);
  const fetchedAt: Date = new Date();
  const created = await prisma.npmPackage.create({
    data: {
      name,
      data: data as unknown as Prisma.InputJsonValue,
      fetchedAt,
    },
  });
  const body: NpmPackageResponse = {
    ok: true,
    data,
    meta: { fetchedAt: created.fetchedAt.toISOString(), cacheHit: false },
  };
  return NextResponse.json(body, { headers: NO_STORE_HEADERS });
}

async function listAll(): Promise<NextResponse<ListNpmPackagesResponse>> {
  const rows = await prisma.npmPackage.findMany({
    orderBy: { fetchedAt: "desc" },
  });
  const body: ListNpmPackagesResponse = {
    ok: true,
    data: rows.map(serializeSummary),
  };
  return NextResponse.json(body, { headers: NO_STORE_HEADERS });
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<NpmPackageResponse | ListNpmPackagesResponse | ErrorResponse>> {
  try {
    const name: string | null = request.nextUrl.searchParams.get("name");
    if (name && name.trim().length > 0) {
      return await readThrough(name.trim());
    }
    return await listAll();
  } catch (error) {
    if (error instanceof NpmFetchError) {
      return errorResponse(error.code, error.status);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
): Promise<NextResponse<{ ok: true } | ErrorResponse>> {
  try {
    const params: URLSearchParams = request.nextUrl.searchParams;
    if (params.get("all") === "true") {
      await prisma.npmPackage.deleteMany({});
      return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
    }

    const id: string | null = params.get("id");
    if (!id || id.trim().length === 0) {
      return errorResponse("id or all=true is required", 400);
    }
    await prisma.npmPackage.delete({ where: { id: id.trim() } });
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500);
  }
}
