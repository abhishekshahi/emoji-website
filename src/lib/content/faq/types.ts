import type { ContentProvenance } from "../types";

export interface FaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly category: string;
  readonly relatedSlugs?: readonly string[];
  readonly provenance: ContentProvenance;
}

export interface FaqSection {
  readonly id: string;
  readonly title: string;
  readonly items: readonly FaqItem[];
}
