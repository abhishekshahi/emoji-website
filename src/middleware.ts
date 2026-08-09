import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveApprovedEmojiRedirect } from "@/lib/master/integration/seo-migration/redirects";

export function middleware(request: NextRequest) {
  const redirect = resolveApprovedEmojiRedirect(request.nextUrl.pathname);
  if (!redirect) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(redirect.to, request.url), redirect.status);
}

export const config = {
  matcher: ["/emoji/:slug+"],
};
