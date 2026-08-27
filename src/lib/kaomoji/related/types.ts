export interface RelatedKaomojiCandidate {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly normalized_content?: string;
  readonly accessible_name: string;
  readonly editorial_name?: string | null;
  readonly quality_score?: number;
  readonly relationship_type: string;
  readonly confidence: string;
  readonly score: number;
  readonly category_label?: string | null;
}

export interface RelatedKaomojiHit {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly name: string | null;
  readonly accessible_name: string;
  readonly reason: string;
  readonly relationship_type: string;
}

export interface RelatedKaomojiBundle {
  readonly similar: readonly RelatedKaomojiHit[];
  readonly related: readonly RelatedKaomojiHit[];
}

export interface PartitionRelatedOptions {
  readonly similarLimit?: number;
  readonly relatedLimit?: number;
  readonly sourceCanonicalId: string;
}
