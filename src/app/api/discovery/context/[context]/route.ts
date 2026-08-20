import { NextResponse } from "next/server";
import { getContextDiscovery, parseDiscoveryContext } from "@/lib/discovery/engine";
import { jsonResponseHeaders } from "@/lib/master/r2/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ context: string }> },
): Promise<NextResponse> {
  const { context: contextParam } = await context.params;
  const parsed = parseDiscoveryContext(contextParam);

  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid context. Use instagram, discord, tiktok, whatsapp, x, gaming, or work." },
      { status: 400, headers: jsonResponseHeaders() },
    );
  }

  return NextResponse.json(getContextDiscovery(parsed), { headers: jsonResponseHeaders() });
}
