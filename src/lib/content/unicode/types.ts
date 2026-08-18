import type { ContentProvenance } from "../types";

export interface UnicodeVersionRecord {
  readonly version: string;
  readonly emojiVersion?: string;
  readonly releaseDate?: string;
  readonly summary: string;
  readonly milestone?: boolean;
  readonly relatedEmojiSlugs?: readonly string[];
  readonly provenance: ContentProvenance;
}

export interface UnicodeMilestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly year?: number;
  readonly provenance: ContentProvenance;
}
