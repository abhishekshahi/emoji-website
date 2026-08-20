import type { KaomojiEditorialRecord } from "../phase9/types";
import type { ScoreComponents } from "./types";

export const UNIQUENESS_V1_VERSION = "10.0.0-uniqueness-v1";

export function computeUniquenessV1(
  editorial: KaomojiEditorialRecord,
  normFrequency: Map<string, number>,
): { score: number; components: ScoreComponents } {
  const freq = normFrequency.get(editorial.normalized_content) ?? 1;
  const visualDistinct = Math.min(100, new Set(editorial.canonical_content).size * 10);
  const structuralDistinct = Math.min(100, editorial.canonical_content.length * 3);
  const comboUnique = Math.max(0, 100 - Math.log2(freq + 1) * 15);
  const variantDistinct = editorial.variant_group_id ? 70 : 85;
  const components: ScoreComponents = {
    visual_distinctiveness: visualDistinct,
    structural_distinctiveness: structuralDistinct,
    combination_uniqueness: Math.round(comboUnique),
    variant_distinctiveness: variantDistinct,
  };
  const score = Math.round(
    components.visual_distinctiveness * 0.3 +
    components.structural_distinctiveness * 0.25 +
    components.combination_uniqueness * 0.3 +
    components.variant_distinctiveness * 0.15,
  );
  return { score: Math.min(100, Math.max(0, score)), components };
}
