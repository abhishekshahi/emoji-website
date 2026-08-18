/** Shared content classification for EmojiQuick knowledge platform. */

export type ContentSourceKind = "official" | "translated" | "editorial" | "derived";

export type EditorialStatus = "draft" | "review" | "published" | "archived";

export type ContentQualityStatus = "complete" | "partial" | "stub" | "missing";

export interface ContentProvenance {
  readonly source: ContentSourceKind;
  readonly author?: string;
  readonly lastUpdated: string;
  readonly qualityStatus: ContentQualityStatus;
}
