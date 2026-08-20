import { NextResponse } from "next/server";
import { getPopularDiscovery, parsePopularSort } from "@/lib/discovery/engine";
import { jsonResponseHeaders } from "@/lib/master/r2/http";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const sort = parsePopularSort(url.searchParams.get("sort"));

  if (!sort) {
    return NextResponse.json(
      { error: "Invalid sort. Use copied, searched, saved, or viewed." },
      { status: 400, headers: jsonResponseHeaders() },
    );
  }

  return NextResponse.json(getPopularDiscovery(sort), { headers: jsonResponseHeaders() });
}
