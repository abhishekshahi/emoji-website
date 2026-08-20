import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PUBLISHED_LOCALE_CODES } from "@/lib/content/localization/locales";
import { resolveDocumentLang } from "@/lib/content/localization/document-lang";
import { isSeoMigrationRolloutActive } from "@/lib/master/integration/seo-canary/rollout";

/** Public emoji HTML — safe to edge-cache (canonical URLs, no auth). */
const PUBLIC_EMOJI_HTML_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" as const;

const PUBLISHED_LOCALE_PATTERN = PUBLISHED_LOCALE_CODES.join("|");

function withPublicEmojiHtmlCache(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", PUBLIC_EMOJI_HTML_CACHE_CONTROL);
  return response;
}

function withDocumentLang(request: NextRequest, response: NextResponse): NextResponse {
  const lang = resolveDocumentLang(
    request.nextUrl.pathname,
    request.nextUrl.searchParams.get("lang"),
  );
  response.headers.set("x-document-lang", lang);
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicEmojiPage =
    request.method === "GET" &&
    (/^\/emoji\/[^/]+\/?$/.test(pathname) ||
      new RegExp(`^/(${PUBLISHED_LOCALE_PATTERN})/emoji/[^/]+/?$`).test(pathname));

  if (!isSeoMigrationRolloutActive()) {
    const base = isPublicEmojiPage
      ? withPublicEmojiHtmlCache(NextResponse.next())
      : NextResponse.next();
    return withDocumentLang(request, base);
  }

  const { resolveActiveEmojiRedirect } = await import(
    "@/lib/master/integration/seo-canary/active-migration"
  );
  const redirect = resolveActiveEmojiRedirect(pathname);
  if (redirect) {
    return NextResponse.redirect(new URL(redirect.to, request.url), redirect.status);
  }

  const base = isPublicEmojiPage
    ? withPublicEmojiHtmlCache(NextResponse.next())
    : NextResponse.next();
  return withDocumentLang(request, base);
}

export const config = {
  matcher: [
    "/emoji/:slug*",
    "/search",
    "/es/emoji/:slug*",
    "/fr/emoji/:slug*",
    "/hi/emoji/:slug*",
    "/de/emoji/:slug*",
    "/ja/emoji/:slug*",
    "/pt/emoji/:slug*",
  ],
};
