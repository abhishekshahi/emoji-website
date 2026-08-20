import { EXPECTED_RELEASE_ID } from "@/lib/master/integration/config";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "@/lib/master/r2/catalog";
import { PUBLIC_MASTER_PLATFORM_VERSION } from "./config";
import { getCatalogStats } from "./catalog-service";
import type { PublicDataManifest } from "./types";

export function buildPublicDataManifest(rootDir: string = process.cwd()): PublicDataManifest {
  const stats = getCatalogStats(rootDir);
  return Object.freeze({
    version: PUBLIC_MASTER_PLATFORM_VERSION,
    generatedAt: new Date().toISOString(),
    releaseId: EXPECTED_RELEASE_ID,
    totals: {
      identities: MASTER_IDENTITY_COUNT,
      artworkRecords: MASTER_ARTWORK_RECORD_COUNT,
      publicIdentities: stats.publicIdentities,
      indexableIdentities: stats.indexableIdentities,
    },
    downloads: Object.freeze([
      Object.freeze({
        id: "identities",
        label: "Canonical identities",
        description: "6,955 canonical identity records with Unicode sequences and source references.",
        license: "See /licenses — source-specific terms apply",
        available: false,
        path: null,
      }),
      Object.freeze({
        id: "metadata",
        label: "Metadata index",
        description: "Canonical metadata from Unicode, CLDR, Emojibase, Emojilib, and other sources.",
        license: "Per-source — see /licenses",
        available: false,
        path: null,
      }),
      Object.freeze({
        id: "semantic",
        label: "Semantic search data",
        description: "Safe search terms and semantic indexes with provenance.",
        license: "Per-source — see /licenses",
        available: false,
        path: null,
      }),
      Object.freeze({
        id: "artwork-index",
        label: "Artwork index",
        description: "40,071 artwork records across OpenMoji, Noto, Twemoji, and Fluent.",
        license: "Per-provider — see /licenses",
        available: false,
        path: null,
      }),
      Object.freeze({
        id: "licenses",
        label: "License registry",
        description: "Complete provider and source license information.",
        license: "EmojiQuick compilation",
        available: true,
        path: "/licenses",
      }),
    ]),
    checksum: null,
  });
}
