import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveActiveEmojiRedirect } from "@/lib/master/integration/seo-canary/active-migration";

export function middleware(request: NextRequest) {
  const redirect = resolveActiveEmojiRedirect(request.nextUrl.pathname);
  if (!redirect) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(redirect.to, request.url), redirect.status);
}

export const config = {
  matcher: ["/emoji/:slug+"],
};
