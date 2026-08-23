import type { RankingWeights } from "./types";

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  exact_kaomoji: 10000,
  exact_normalized: 9500,
  exact_name: 9000,
  exact_keyword: 8500,
  exact_meaning: 8000,
  exact_category: 7500,
  emotion_style: 7000,
  prefix: 5000,
  token: 4000,
  synonym: 3000,
  fuzzy: 2000,
};
