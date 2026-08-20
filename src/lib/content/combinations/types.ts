import type { ContentProvenance } from "../types";

export interface EmojiCombination {
  readonly id: string;
  readonly slug: string;
  readonly sequence: string;
  readonly emojiIds: readonly string[];
  readonly title: string;
  readonly meaning: string;
  readonly usage: string;
  readonly contexts?: readonly string[];
  readonly language: string;
  readonly source: "curated" | "analytics" | "editorial";
  readonly quality: "published" | "draft";
  readonly provenance: ContentProvenance;
}
