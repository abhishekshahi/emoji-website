import type { ContentProvenance } from "../types";

export type MeaningContentTier = "rich" | "medium" | "structured";

export interface EmojiMeaningRecord {
  readonly canonicalId: string;
  readonly slug: string;
  readonly language: string;
  readonly summary: string;
  readonly meaning: string;
  readonly usage: string;
  readonly contentTier?: MeaningContentTier;
  readonly literalMeaning?: string;
  readonly emotionalMeaning?: string;
  readonly whenToUse?: string;
  readonly whenNotToUse?: string;
  readonly context?: string;
  readonly interpretations?: readonly string[];
  readonly misunderstandings?: readonly string[];
  readonly examples?: readonly string[];
  readonly relatedConcepts?: readonly string[];
  readonly provenance: ContentProvenance;
}

export interface EmojiMeaningDisplay extends EmojiMeaningRecord {
  readonly isEditorial: boolean;
}
