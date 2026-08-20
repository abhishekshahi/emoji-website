import type { ContentProvenance } from "../types";

export interface EmojiCollection {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly context?: string;
  readonly emojiSlugs: readonly string[];
  readonly emojiIds: readonly string[];
  readonly relatedCollectionSlugs?: readonly string[];
  readonly relatedCombinationSlugs?: readonly string[];
  readonly topicSlug?: string;
  readonly language: string;
  readonly editorialStatus: "published" | "draft";
  readonly provenance: ContentProvenance;
}
