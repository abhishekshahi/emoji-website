import {
  getCanonicalEmojiSitemapSlugs,
  isApprovedRedirectSourceSlug,
  resolveApprovedEmojiRedirect,
  resolveEmojiPageSlug,
} from "../seo-migration/redirects";
import { isSeoMigrationRolloutActive } from "./rollout";

export function resolveActiveEmojiRedirect(pathname: string) {
  if (!isSeoMigrationRolloutActive()) {
    return null;
  }
  return resolveApprovedEmojiRedirect(pathname);
}

export function getActiveEmojiSitemapSlugs(productionSlugs: readonly string[]): string[] {
  if (!isSeoMigrationRolloutActive()) {
    return [...productionSlugs];
  }
  return getCanonicalEmojiSitemapSlugs(productionSlugs);
}

export function resolveActiveEmojiPageSlug(slug: string) {
  if (!isSeoMigrationRolloutActive()) {
    return Object.freeze({ lookupSlug: slug, canonicalSlug: slug });
  }
  return resolveEmojiPageSlug(slug);
}

export function isActiveApprovedRedirectSourceSlug(slug: string): boolean {
  if (!isSeoMigrationRolloutActive()) {
    return false;
  }
  return isApprovedRedirectSourceSlug(slug);
}

