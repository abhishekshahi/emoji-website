import { getSlugForCanonicalId } from "./identity-slug-map";

export function getProductionSlugForCanonical(
  canonicalId: string,
  _rootDir: string = process.cwd(),
): string | null {
  return getSlugForCanonicalId(canonicalId);
}

export function resetProductionSlugCache(): void {
  // identity-slug-map is static JSON; no runtime cache to reset.
}
