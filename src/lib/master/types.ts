export type MasterSourceId =
  | "openmoji"
  | "unicode-emoji-data"
  | "emoji-time"
  | "noto"
  | "twemoji"
  | "fluent"
  | "emojibase"
  | "unicode"
  | "emojilib"
  | "emojinet";

export type MasterSourceKind =
  | "artwork"
  | "metadata"
  | "standard-data"
  | "semantic"
  | "utility";

export interface MasterSourceLockEntry {
  id: MasterSourceId;
  name: string;
  kind: MasterSourceKind[];
  version: string;
  package?: string;
  repository?: string;
  commit?: string;
  checksum?: string;
  license: string;
  licenseUrl: string;
  attribution?: string;
  sourceUrl: string;
  notes?: string;
}

export interface MasterSourceLockFile {
  generatedAt: string;
  phase: "8.1";
  targetUnicodeVersion: "17.0";
  sources: MasterSourceLockEntry[];
}

export interface MasterSourceSnapshotRecord {
  source: MasterSourceId;
  sourceVersion: string;
  sourceId: string;
  rawName: string;
  rawCodepoints: string[];
  rawSequence: string;
  rawArtwork: string | null;
  rawMetadata: Record<string, unknown>;
  license: string;
  attribution: string | null;
  sourceURL: string;
}

export interface MasterSourceSnapshotManifest {
  source: MasterSourceId;
  sourceVersion: string;
  generatedAt: string;
  recordCount: number;
  artworkCount: number;
  metadataCount: number;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

export interface MasterArtworkAsset {
  provider: "openmoji" | "noto" | "twemoji" | "fluent";
  path: string;
  version: string;
  checksum: string;
  license: string;
  licenseUrl: string;
  attribution?: string;
  variant?: string;
}

export interface MasterEmojiRecord {
  canonicalId: string;
  emoji: string;
  unicodeSequence: string;
  isUnicode: boolean;
  slug: string;
  name: string;
  sourceNames: string[];
  aliases: string[];
  keywords: string[];
  shortcodes: string[];
  descriptions: string[];
  group: string | null;
  subgroup: string | null;
  unicodeVersion: string | null;
  emojiVersion: string | null;
  artwork: {
    openmoji: MasterArtworkAsset[];
    noto: MasterArtworkAsset[];
    twemoji: MasterArtworkAsset[];
    fluent: MasterArtworkAsset[];
  };
  metadataSources: MasterSourceId[];
  semanticSources: MasterSourceId[];
  sourceRecords: Array<{
    source: MasterSourceId;
    sourceId: string;
    sourceVersion: string;
  }>;
  licenses: Array<{
    source: MasterSourceId | MasterArtworkAsset["provider"];
    license: string;
    licenseUrl: string;
    attribution?: string;
  }>;
}

export interface MasterDatabaseManifest {
  generatedAt: string;
  phase: string;
  emojifindPreserved: {
    standardRecords: number;
    extrasRecords: number;
    searchableItems: number;
  };
  totals: {
    rawRecords: number;
    uniqueCanonicalRecords: number;
    uniqueUnicodeRecords: number;
    uniqueNonUnicodeRecords: number;
    artworkAssets: number;
    metadataRecords: number;
    aliases: number;
    keywords: number;
    shortcodes: number;
    semanticRecords: number;
  };
}

export interface MasterSourceAuditEntry {
  source: MasterSourceId;
  status: "installed" | "available" | "missing" | "pending";
  versionExpected: string;
  versionInstalled: string | null;
  rawRecords: number | null;
  rawArtwork: number | null;
  rawMetadata: number | null;
  uniqueUnicode: number | null;
  uniqueNonUnicode: number | null;
  duplicates: number | null;
  merged: number | null;
  newRecords: number | null;
  unmatched: number | null;
  license: string;
  commitOrChecksum: string | null;
  notes: string[];
}

export interface MasterAuditReport {
  generatedAt: string;
  phase: "8.1";
  lockFile: string;
  existingProject: {
    standardRecords: number;
    extrasRecords: number;
    searchableItems: number;
    openmojiArtwork: {
      standard: number;
      extrasOpenmoji: number;
      extrasUnicode: number;
    };
  };
  sources: MasterSourceAuditEntry[];
}
