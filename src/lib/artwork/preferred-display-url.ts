import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import type { PreferredArtworkResult } from "@/lib/artwork/resolve-preferred-artwork";

/** Prefer static OpenMoji bundle path when OpenMoji wins resolution. */
export function resolvePreferredDisplayUrl(
  preferred: PreferredArtworkResult | null,
  openmojiHexcode: string,
): string | null {
  if (!preferred) {
    return getOpenMojiArtworkPath(openmojiHexcode);
  }

  if (preferred.provider === "openmoji") {
    const staticPath = getOpenMojiArtworkPath(openmojiHexcode);
    if (staticPath) return staticPath;
  }

  return preferred.url;
}
