import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSeoMigrationRolloutActive } from "@/lib/master/integration/seo-canary/rollout";

export async function middleware(request: NextRequest) {
  if (!isSeoMigrationRolloutActive()) {
    return NextResponse.next();
  }

  const { resolveActiveEmojiRedirect } = await import(
    "@/lib/master/integration/seo-canary/active-migration"
  );
  const redirect = resolveActiveEmojiRedirect(request.nextUrl.pathname);
  if (!redirect) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(redirect.to, request.url), redirect.status);
}

export const config = {
  matcher: ["/emoji/:slug+"],
};
