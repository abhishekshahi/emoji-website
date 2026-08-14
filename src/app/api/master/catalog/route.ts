import { NextResponse } from "next/server";
import {
  isPublicMasterApiEnabled,
  PUBLIC_API_DEFAULT_PAGE_SIZE,
  PUBLIC_API_MAX_PAGE_SIZE,
} from "@/lib/master/public/config";
import { queryCatalog } from "@/lib/master/public/catalog-service";
import type { CatalogFilterType } from "@/lib/master/public/catalog-service";
import type { ArtworkProvider } from "@/lib/master/canonical/types";
import { shouldReadFromR2Binding } from "@/lib/master/r2/config";
import { jsonResponseHeaders } from "@/lib/master/r2/http";
import { queryPublicCatalogFromR2 } from "@/lib/master/public/r2-service";
import { toPublicMasterError } from "@/lib/r2";

export async function GET(request: Request): Promise<NextResponse> {
  if (!isPublicMasterApiEnabled()) {
    return NextResponse.json({ error: "Public master API is disabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const filter = (url.searchParams.get("filter") ?? "all") as CatalogFilterType;
  const provider = url.searchParams.get("provider") as ArtworkProvider | null;
  const search = url.searchParams.get("q") ?? undefined;
  const sort = (url.searchParams.get("sort") ?? "name") as "name" | "unicode" | "type";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    PUBLIC_API_MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? String(PUBLIC_API_DEFAULT_PAGE_SIZE))),
  );

  try {
    const result = shouldReadFromR2Binding()
      ? await queryPublicCatalogFromR2({ filter, provider: provider ?? undefined, search, sort, page, pageSize })
      : queryCatalog({ filter, provider: provider ?? undefined, search, sort, page, pageSize });

    return NextResponse.json(result, { headers: jsonResponseHeaders() });
  } catch (error: unknown) {
    const pub = toPublicMasterError(error);
    return NextResponse.json(
      { error: pub.message, code: pub.code },
      { status: pub.code === "NOT_FOUND" ? 404 : 503, headers: jsonResponseHeaders() },
    );
  }
}
