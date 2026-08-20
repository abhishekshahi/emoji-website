export type EnrichmentArtworkProvider = "openmoji" | "noto" | "twemoji" | "fluent";

export type EnrichmentVariantKind =
  | "skin-tone"
  | "gender"
  | "profession"
  | "family"
  | "couple"
  | "zwj"
  | "flag"
  | "keycap"
  | "sequence"
  | "related";

export interface EnrichmentDefinition {
  readonly text: string;
  readonly source: string;
}

export interface EnrichmentVariantLink {
  readonly slug: string;
  readonly label: string;
  readonly kind: EnrichmentVariantKind;
}

export interface EnrichmentRelatedLink {
  readonly slug: string;
  readonly reason: "category" | "subcategory" | "semantic" | "variant";
}

export interface EnrichmentArtworkCompact {
  readonly primary: EnrichmentArtworkProvider;
  readonly count: number;
  readonly p: Readonly<
    Record<
      string,
      {
        readonly f: readonly ("svg" | "png" | "other")[];
        readonly n: number;
        readonly s: boolean;
      }
    >
  >;
}

export interface EmojiEnrichmentRecord {
  readonly canonicalId: string;
  readonly officialName: string | null;
  readonly aliases: readonly string[];
  readonly searchTerms: readonly string[];
  readonly definitions: readonly EnrichmentDefinition[];
  readonly artwork: EnrichmentArtworkCompact;
  readonly variantBaseSlug: string | null;
  readonly variants: readonly EnrichmentVariantLink[];
  readonly related: readonly EnrichmentRelatedLink[];
}

export interface EmojiEnrichmentFile {
  readonly generatedAt: string;
  readonly releaseId: string;
  readonly recordCount: number;
  readonly bySlug: Readonly<Record<string, EmojiEnrichmentRecord>>;
}

export interface EmojiSearchEnrichmentFile {
  readonly generatedAt: string;
  readonly releaseId: string;
  readonly recordCount: number;
  readonly byId: Readonly<Record<string, readonly string[]>>;
}
