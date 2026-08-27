import "server-only";
import { NextResponse } from "next/server";
import { resolvePublicKaomojiByIds } from "@/lib/kaomoji/cloudflare/d1-personal";
import { KAOMOJI_CANONICAL_ID_RE } from "@/lib/kaomoji/personal/sanitize";

const MAX_RESOLVE_IDS = 100;

interface ResolveBody {
  ids?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: ResolveBody;
  try {
    body = (await request.json()) as ResolveBody;
  } catch {
    return NextResponse.json({ error: "invalid_json", items: [] }, { status: 400 });
  }

  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && KAOMOJI_CANONICAL_ID_RE.test(id)))].slice(
    0,
    MAX_RESOLVE_IDS,
  );

  if (ids.length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await resolvePublicKaomojiByIds(ids);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "method_not_allowed", items: [] }, { status: 405 });
}
