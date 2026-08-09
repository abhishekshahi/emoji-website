import manifest from "@/data/openmoji-manifest.json";
import extrasArtworkManifest from "@/data/openmoji-extras-artwork-manifest.json";

export type OpenMojiCollection =
  | "standard"
  | "extras-openmoji"
  | "extras-unicode";

export interface OpenMojiArtworkEntry {
  path: string;
  sourceHexcode: string;
}

export interface OpenMojiExtraArtworkEntry extends OpenMojiArtworkEntry {
  collection: "extras-openmoji" | "extras-unicode";
}

export interface OpenMojiArtworkManifest {
  generatedAt: string;
  openmojiVersion: string;
  format: "svg";
  collection: "standard";
  imported: number;
  missing: number;
  totalEmojis: number;
  artwork: Record<string, OpenMojiArtworkEntry>;
}

export interface OpenMojiExtrasArtworkManifest {
  generatedAt: string;
  openmojiVersion: string;
  format: "svg";
  imported: number;
  missing: number;
  totalExtras: number;
  collections: {
    "extras-openmoji": {
      imported: number;
      missing: number;
      expected: number;
    };
    "extras-unicode": {
      imported: number;
      missing: number;
      expected: number;
    };
  };
  artwork: Record<string, OpenMojiExtraArtworkEntry>;
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

export function getOpenMojiArtworkCollection(
  hexcode: string,
): OpenMojiCollection | null {
  if (openMojiManifest.artwork[hexcode]) {
    return "standard";
  }

  return openMojiExtrasArtworkManifest.artwork[hexcode]?.collection ?? null;
}

export function hasOpenMojiArtwork(hexcode: string): boolean {
  return Boolean(getOpenMojiArtworkPath(hexcode));
}

export function getOpenMojiArtworkUrl(hexcode: string): string | null {
  return getOpenMojiArtworkPath(hexcode);
}
