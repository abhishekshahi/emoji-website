import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ArtworkChecksumEntry } from "@/lib/master/artwork/types";
import type { ArtworkReleaseChecksums } from "@/lib/master/release/types";
import { integrationDataPaths } from "../config";
import { MasterIntegrationError } from "../types";

let checksumIndex: Map<string, ArtworkChecksumEntry> | null = null;
let releaseChecksumManifest: ArtworkReleaseChecksums | null = null;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function getArtworkChecksumIndex(rootDir: string = process.cwd()): ReadonlyMap<string, ArtworkChecksumEntry> {
  if (checksumIndex) {
    return checksumIndex;
  }

  const { masterDir } = integrationDataPaths(rootDir);
  const entries = readJson<ArtworkChecksumEntry[]>(join(masterDir, "artwork/artwork-checksums.json"));
  checksumIndex = new Map(entries.map((entry) => [entry.artworkId, Object.freeze(entry)]));
  return checksumIndex;
}

export function getArtworkReleaseChecksumManifest(rootDir: string = process.cwd()): ArtworkReleaseChecksums {
  if (releaseChecksumManifest) {
    return releaseChecksumManifest;
  }

  const { releaseDir } = integrationDataPaths(rootDir);
  releaseChecksumManifest = Object.freeze(
    readJson<ArtworkReleaseChecksums>(join(releaseDir, "artwork-release-checksums.json")),
  );
  return releaseChecksumManifest;
}

export function verifyArtworkChecksum(artworkId: string, checksum: string, rootDir?: string): boolean {
  const entry = getArtworkChecksumIndex(rootDir).get(artworkId);
  if (!entry) {
    return false;
  }
  if (!entry.checksumVerified) {
    return false;
  }
  return entry.checksum === checksum;
}

export function assertArtworkChecksum(artworkId: string, checksum: string, rootDir?: string): void {
  if (!verifyArtworkChecksum(artworkId, checksum, rootDir)) {
    throw new MasterIntegrationError(
      `Artwork checksum verification failed for ${artworkId}`,
      "CHECKSUM_FAILURE",
    );
  }
}

export function resetArtworkChecksumCache(): void {
  checksumIndex = null;
  releaseChecksumManifest = null;
}
