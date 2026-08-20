import type { EnrichmentArtworkCompact, EnrichmentVariantKind } from "./enrichment-types";

/** Single-character variant kind codes stored in enrichment JSON. */
export type CompactVariantKindCode =
  | "t"
  | "g"
  | "p"
  | "f"
  | "c"
  | "z"
  | "l"
  | "k"
  | "s"
  | "r";

/** Compact variant reference: [target slug, kind code]. */
export type CompactVariant = readonly [slug: string, kind: CompactVariantKindCode];

/** Grouped related emoji slugs by relationship reason. */
export interface CompactRelatedGrouped {
  readonly b?: readonly string[];
  readonly m?: readonly string[];
  readonly c?: readonly string[];
  readonly v?: readonly string[];
}

/** Compact on-disk enrichment record (short keys minimize JSON size). */
export interface CompactEmojiEnrichmentRecord {
  readonly i: string;
  readonly o: string | null;
  readonly a?: readonly string[];
  readonly t?: readonly string[];
  readonly d?: readonly string[];
  readonly w: EnrichmentArtworkCompact;
  readonly bs?: string;
  readonly v?: readonly CompactVariant[];
  readonly r?: CompactRelatedGrouped;
}

export interface EmojiEnrichmentCompactFile {
  readonly generatedAt: string;
  readonly releaseId: string;
  readonly recordCount: number;
  readonly schemaVersion: 2;
  readonly bySlug: Readonly<Record<string, CompactEmojiEnrichmentRecord>>;
}

export type VariantKindCodec = {
  readonly encode: (kind: EnrichmentVariantKind) => CompactVariantKindCode;
  readonly decode: (code: CompactVariantKindCode) => EnrichmentVariantKind;
};
export function parseEmojiEnrichmentCompactFile(value: unknown): EmojiEnrichmentCompactFile {
  return value as EmojiEnrichmentCompactFile;
}