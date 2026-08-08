import manifest from "@/data/openmoji-manifest.json";

export interface OpenMojiArtworkManifest {
  generatedAt: string;
  openmojiVersion: string;
  format: "svg";
  imported: number;
  missing: number;
  totalEmojis: number;
  artwork: Record<
    string,
    {
      path: string;
      sourceHexcode: string;
    }
  >;
}

const openMojiManifest = manifest as OpenMojiArtworkManifest;

export function getOpenMojiManifest(): OpenMojiArtworkManifest {
  return openMojiManifest;
}

export function getOpenMojiArtworkPath(hexcode: string): string | null {
  return openMojiManifest.artwork[hexcode]?.path ?? null;
}

export function hasOpenMojiArtwork(hexcode: string): boolean {
  return Boolean(openMojiManifest.artwork[hexcode]);
}

export function getOpenMojiArtworkUrl(hexcode: string): string | null {
  const path = getOpenMojiArtworkPath(hexcode);
  return path;
}
