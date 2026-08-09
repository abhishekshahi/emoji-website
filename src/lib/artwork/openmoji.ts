import manifest from "@/data/openmoji-manifest.json";
import extrasArtworkManifest from "@/data/openmoji-extras-artwork-manifest.json";

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

export interface OpenMojiExtrasArtworkManifest {
  generatedAt: string;
  openmojiVersion: string;
  format: "svg";
  imported: number;
  missing: number;
  totalExtras: number;
  artwork: Record<
    string,
    {
      path: string;
      sourceHexcode: string;
    }
  >;
}

const openMojiManifest = manifest as OpenMojiArtworkManifest;
const openMojiExtrasArtworkManifest =
  extrasArtworkManifest as OpenMojiExtrasArtworkManifest;

export function getOpenMojiManifest(): OpenMojiArtworkManifest {
  return openMojiManifest;
}

export function getOpenMojiExtrasArtworkManifest(): OpenMojiExtrasArtworkManifest {
  return openMojiExtrasArtworkManifest;
}

export function getOpenMojiArtworkPath(hexcode: string): string | null {
  return (
    openMojiManifest.artwork[hexcode]?.path ??
    openMojiExtrasArtworkManifest.artwork[hexcode]?.path ??
    null
  );
}

export function hasOpenMojiArtwork(hexcode: string): boolean {
  return Boolean(openMojiManifest.artwork[hexcode]);
}

export function getOpenMojiArtworkUrl(hexcode: string): string | null {
  const path = getOpenMojiArtworkPath(hexcode);
  return path;
}
