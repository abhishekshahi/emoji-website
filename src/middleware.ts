import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSeoMigrationRolloutActive } from "@/lib/master/integration/seo-canary/rollout";

/** Public emoji HTML — safe to edge-cache (canonical URLs, no auth). */
const PUBLIC_EMOJI_HTML_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" as const;

function withPublicEmojiHtmlCache(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", PUBLIC_EMOJI_HTML_CACHE_CONTROL);
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicEmojiPage =
    request.method === "GET" && /^\/emoji\/[^/]+\/?$/.test(pathname);

  if (!isSeoMigrationRolloutActive()) {
    return isPublicEmojiPage
      ? withPublicEmojiHtmlCache(NextResponse.next())
      : NextResponse.next();
  }

  const { resolveActiveEmojiRedirect } = await import(
    "@/lib/master/integration/seo-canary/active-migration"
  );
  const redirect = resolveActiveEmojiRedirect(pathname);
  if (redirect) {
    return NextResponse.redirect(new URL(redirect.to, request.url), redirect.status);
  }

  return isPublicEmojiPage
    ? withPublicEmojiHtmlCache(NextResponse.next())
    : NextResponse.next();
}

export const config = {
  matcher: ["/emoji/:slug+"],
};
