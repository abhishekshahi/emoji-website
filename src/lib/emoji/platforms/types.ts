import type { ArtworkProvider } from "@/lib/master/artwork/types";

export type PlatformPageKind = "vendor" | "open-source" | "guide";

export interface PlatformPageGuide {
  readonly slug: string;
  readonly kind: PlatformPageKind;
  readonly title: string;
  readonly h1: string;
  readonly description: string;
  readonly intro: string;
  readonly renderingNotes: string;
  readonly availability?: string;
  /** Open-source artwork proxy EmojiQuick can serve — never implies vendor artwork. */
  readonly artworkProxy: ArtworkProvider | null;
  readonly hasVerifiedArtwork: boolean;
  readonly relatedSlugs: readonly string[];
}

export interface ProviderArtworkTile {
  readonly provider: ArtworkProvider;
  readonly label: string;
  readonly url: string | null;
  readonly license: string;
  readonly publiclyServed: boolean;
  readonly note: string;
}

export interface EmojiPlatformComparisonView {
  readonly unicodeGlyph: string;
  readonly codePointString: string;
  readonly hexcode: string;
  readonly name: string;
  readonly unicodeVersion: string;
  readonly openSourceTiles: readonly ProviderArtworkTile[];
  readonly vendorNote: string;
}

export interface SampleComparisonItem {
  readonly slug: string;
  readonly label: string;
  readonly comparison: EmojiPlatformComparisonView;
}
