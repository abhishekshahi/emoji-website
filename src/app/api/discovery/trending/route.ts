import { NextResponse } from "next/server";
import { getTrendingDiscovery, parseDiscoveryPeriod } from "@/lib/discovery/engine";
import { jsonResponseHeaders } from "@/lib/master/r2/http";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const period = parseDiscoveryPeriod(url.searchParams.get("period"));

  if (!period) {
    return NextResponse.json(
      { error: "Invalid period. Use today, week, or month." },
      { status: 400, headers: jsonResponseHeaders() },
    );
  }

  return NextResponse.json(getTrendingDiscovery(period), { headers: jsonResponseHeaders() });
}
