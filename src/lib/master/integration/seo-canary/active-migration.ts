import { isSeoMigrationRolloutActive } from "./rollout";

type RedirectsModule = typeof import("../seo-migration/redirects");

function loadRedirectsModule(): RedirectsModule {
  // Lazy require keeps redirect data out of OFF-mode middleware and page bundles.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../seo-migration/redirects") as RedirectsModule;
}

export function resolveActiveEmojiRedirect(pathname: string) {
  if (!isSeoMigrationRolloutActive()) {
    return null;
  }
  return loadRedirectsModule().resolveApprovedEmojiRedirect(pathname);
}

export function getActiveEmojiSitemapSlugs(productionSlugs: readonly string[]): string[] {
  if (!isSeoMigrationRolloutActive()) {
    return [...productionSlugs];
  }
  return loadRedirectsModule().getCanonicalEmojiSitemapSlugs(productionSlugs);
}

export function resolveActiveEmojiPageSlug(slug: string) {
  if (!isSeoMigrationRolloutActive()) {
    return Object.freeze({ lookupSlug: slug, canonicalSlug: slug });
  }
  return loadRedirectsModule().resolveEmojiPageSlug(slug);
}

export function isActiveApprovedRedirectSourceSlug(slug: string): boolean {
  if (!isSeoMigrationRolloutActive()) {
    return false;
  }
  return loadRedirectsModule().isApprovedRedirectSourceSlug(slug);
}
