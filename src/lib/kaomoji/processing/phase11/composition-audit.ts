import type { CanonicalRecord } from "../phase8/types";
import type { KaomojiEditorialRecord } from "../phase9/types";
import type { Phase10ScoredRecord } from "../phase10/types";
import { EMOJIQUICK_TAXONOMY } from "../phase9/taxonomy";
import { scoreDistribution } from "../phase10/overall-v1";
import type { ClassificationConfidence, CountWithConfidence, CanonicalCandidateDefinition } from "./types";

export const CANONICAL_CANDIDATE_DEFINITION: CanonicalCandidateDefinition = {
  term: "canonical candidate",
  definition:
    "One Phase 8 canonical-records.json entry keyed by canonical_id, representing a single deduplicated normalized_content cluster with all source_occurrences and created_from_raw_ids preserved. It is an analytical library unit, not a deleted/raw record and not necessarily public.",
  source_of_truth: "data/kaomoji/processed/phase-8/proposed-library/canonical-records.json",
  count: 63248,
};

const EMOTION_SLUGS = EMOJIQUICK_TAXONOMY.filter((t) => t.group === "EMOTION").map((t) => t.slug);
const RELATIONSHIP_SLUGS = EMOJIQUICK_TAXONOMY.filter((t) => t.group === "LOVE_RELATIONSHIP").map((t) => t.slug);
const CUTE_SLUGS = EMOJIQUICK_TAXONOMY.filter((t) => t.group === "CUTE_KAWAII").map((t) => t.slug);
const ANIMAL_SLUGS = EMOJIQUICK_TAXONOMY.filter((t) => t.group === "ANIMALS").map((t) => t.slug);
const ACTION_SLUGS = EMOJIQUICK_TAXONOMY.filter((t) => t.group === "ACTIONS").map((t) => t.slug);
const STYLE_SLUGS = EMOJIQUICK_TAXONOMY.filter((t) => t.group === "STYLE").map((t) => t.slug);

function emptyCounts(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

function confidenceFor(ed: KaomojiEditorialRecord): ClassificationConfidence {
  if (ed.category_status === "ASSIGNED") return "CONFIRMED";
  if (ed.emojiquick_categories.length === 0) return "REVIEW";
  return "INFERRED";
}

function countByPrimarySlug(
  editorial: readonly KaomojiEditorialRecord[],
  slugs: readonly string[],
  group: string,
): Record<string, number> {
  const counts = emptyCounts([...slugs, "other", "unclassified"]);
  for (const ed of editorial) {
    const inGroup = ed.emojiquick_categories.filter((c) => c.group === group);
    const primary = inGroup[0]?.slug;
    if (primary && slugs.includes(primary)) counts[primary] = (counts[primary] ?? 0) + 1;
    else if (inGroup.length > 0) counts.other = (counts.other ?? 0) + 1;
    else counts.unclassified = (counts.unclassified ?? 0) + 1;
  }
  return counts;
}

function countAnySlug(
  editorial: readonly KaomojiEditorialRecord[],
  slugs: readonly string[],
  group: string,
  otherKey: string,
  unclassifiedKey: string,
): Record<string, number> {
  const counts = emptyCounts([...slugs, otherKey, unclassifiedKey]);
  for (const ed of editorial) {
    const matched = ed.emojiquick_categories.filter((c) => c.group === group && slugs.includes(c.slug));
    if (matched.length === 0) {
      counts[unclassifiedKey] = (counts[unclassifiedKey] ?? 0) + 1;
      continue;
    }
    for (const m of matched) counts[m.slug] = (counts[m.slug] ?? 0) + 1;
  }
  return counts;
}

function inferStyle(content: string): string[] {
  const styles: string[] = [];
  if (/[\u3040-\u30ff\u3000-\u303f\u4e00-\u9fff]/.test(content)) styles.push("japanese");
  if (/^[\x00-\x7F]+$/.test(content) && /[()^_\-=]/.test(content)) styles.push("ascii");
  if (/[^\x00-\x7F]/.test(content)) styles.push("unicode");
  if (content.length <= 8) styles.push("minimal");
  if (/[♥♡❤✧✿☆★~*]/.test(content)) styles.push("decorative");
  if (/[｡◕‿◕｡]/.test(content)) styles.push("cute");
  if (content.length > 30) styles.push("complex");
  else if (content.length <= 12) styles.push("simple");
  return styles;
}

export interface CompositionAuditInput {
  readonly canonical: readonly CanonicalRecord[];
  readonly editorial: readonly KaomojiEditorialRecord[];
  readonly scored: readonly Phase10ScoredRecord[];
  readonly variantGroups: readonly { variant_group_id: string; variant_type: string; raw_ids: string[] }[];
}

export interface CompositionAuditResult {
  readonly definition: CanonicalCandidateDefinition;
  readonly primary_content_type: Record<string, number>;
  readonly secondary_content_type_labels: number;
  readonly style_primary: Record<string, number>;
  readonly style_multi_label_records: number;
  readonly emotion: Record<string, number>;
  readonly emotion_confidence: Record<string, number>;
  readonly relationship: Record<string, number>;
  readonly cute_kawaii: Record<string, number>;
  readonly animals: Record<string, number>;
  readonly actions: Record<string, number>;
  readonly variant_composition: Record<string, number>;
  readonly variant_canonical_counts: Record<string, number>;
  readonly unique_composition: Record<string, number | Record<string, number>>;
  readonly quality_buckets: Record<string, number>;
  readonly beauty_distribution: Record<string, number>;
  readonly uniqueness_distribution: Record<string, number>;
  readonly expressiveness_distribution: Record<string, number>;
  readonly overall_distribution: Record<string, number>;
  readonly publication: Record<string, number>;
  readonly curation: Record<string, number>;
  readonly license: Record<string, number>;
  readonly provenance: Record<string, number>;
  readonly public_candidates: number;
  readonly review: number;
  readonly remove_candidates: number;
  readonly duplicate_groups: number;
  readonly variant_groups: number;
  readonly legitimate_variants: number;
  readonly unique_records: number;
  readonly records: readonly Record<string, unknown>[];
}

export function runCompositionAudit(input: CompositionAuditInput): CompositionAuditResult {
  const editorialById = new Map(input.editorial.map((e) => [e.canonical_id, e]));
  const scoredById = new Map(input.scored.map((s) => [s.canonical_id, s]));
  const rawToCanonical = new Map<string, string>();
  for (const c of input.canonical) for (const rid of c.created_from_raw_ids) rawToCanonical.set(rid, c.canonical_id);

  const primaryContentType: Record<string, number> = {};
  let secondaryLabels = 0;
  for (const c of input.canonical) {
    primaryContentType[c.content_type] = (primaryContentType[c.content_type] ?? 0) + 1;
    if (c.content_type_labels.length > 1) secondaryLabels += c.content_type_labels.length - 1;
  }

  const stylePrimary = emptyCounts([
    "japanese", "western", "ascii", "unicode", "minimal", "decorative", "aesthetic", "classic", "complex", "simple", "funny", "cute", "extreme", "other", "review",
  ]);
  let styleMultiLabel = 0;
  for (const ed of input.editorial) {
    const styleCats = ed.emojiquick_categories.filter((c) => c.group === "STYLE");
    let primary = styleCats[0]?.slug ?? null;
    if (!primary) {
      const inferred = inferStyle(ed.canonical_content);
      primary = inferred[0] ?? "review";
      if (inferred.length === 0) stylePrimary.review += 1;
      else stylePrimary[primary in stylePrimary ? primary : "other"] = (stylePrimary[primary in stylePrimary ? primary : "other"] ?? 0) + 1;
    } else {
      const key = STYLE_SLUGS.includes(primary) ? primary : "other";
      stylePrimary[key] = (stylePrimary[key] ?? 0) + 1;
    }
    if (styleCats.length > 1 || (styleCats.length === 0 && inferStyle(ed.canonical_content).length > 1)) styleMultiLabel += 1;
  }

  const emotion = countByPrimarySlug(input.editorial, EMOTION_SLUGS, "EMOTION");
  const emotionConfidence = { CONFIRMED: 0, INFERRED: 0, REVIEW: 0 };
  for (const ed of input.editorial) {
    const hasEmotion = ed.emojiquick_categories.some((c) => c.group === "EMOTION");
    if (!hasEmotion) emotionConfidence.REVIEW += 1;
    else emotionConfidence[confidenceFor(ed)] += 1;
  }
  const relationship = countByPrimarySlug(input.editorial, RELATIONSHIP_SLUGS, "LOVE_RELATIONSHIP");
  const cute = countAnySlug(input.editorial, CUTE_SLUGS, "CUTE_KAWAII", "other_cute", "not_classified");
  const animals = countAnySlug(input.editorial, ANIMAL_SLUGS, "ANIMALS", "other_animal", "animal_unclassified");
  const actions = countAnySlug(input.editorial, ACTION_SLUGS, "ACTIONS", "other_action", "no_action");

  const legitimateVariantGroups = input.variantGroups.filter((v) => v.variant_type !== "category_context");
  const reviewVariantGroups = input.variantGroups.filter((v) => v.variant_type === "category_context");
  const variantComposition: Record<string, number> = {
    total_groups: input.variantGroups.length,
    legitimate_variants: legitimateVariantGroups.length,
    review_variants: reviewVariantGroups.length,
    duplicate_like_variants: input.canonical.filter((c) => c.near_duplicate_review).length,
  };
  const variantCanonicalCounts: Record<string, number> = {
    EYE_VARIANT: 0, MOUTH_VARIANT: 0, HAND_VARIANT: 0, DECORATIVE_VARIANT: 0, STYLE_VARIANT: 0,
    EMOTION_VARIANT: 0, INTENSITY_VARIANT: 0, SPACING_VARIANT: 0, UNICODE_VARIANT: 0, OTHER: 0,
  };
  const variantCanonicalSets: Record<string, Set<string>> = Object.fromEntries(
    Object.keys(variantCanonicalCounts).map((k) => [k, new Set<string>()]),
  );
  for (const vg of input.variantGroups) {
    const vt = vg.variant_type ?? "other";
    let bucket = "OTHER";
    if (vt.includes("formatting") || vt.includes("spacing")) bucket = "SPACING_VARIANT";
    else if (vt.includes("unicode")) bucket = "UNICODE_VARIANT";
    else if (vt.includes("category")) bucket = "EMOTION_VARIANT";
    for (const rid of vg.raw_ids) {
      const cid = rawToCanonical.get(rid);
      if (cid) variantCanonicalSets[bucket].add(cid);
    }
  }
  for (const [k, set] of Object.entries(variantCanonicalSets)) variantCanonicalCounts[k] = set.size;

  const uniqueRecords = input.canonical.filter((c) => c.created_from_raw_ids.length === 1);
  const uniqueByContentType: Record<string, number> = {};
  const uniqueByLicense: Record<string, number> = {};
  const uniqueByQuality: Record<string, number> = {};
  const uniqueByProvenance: Record<string, number> = {};
  for (const c of uniqueRecords) {
    uniqueByContentType[c.content_type] = (uniqueByContentType[c.content_type] ?? 0) + 1;
    uniqueByLicense[c.license_status] = (uniqueByLicense[c.license_status] ?? 0) + 1;
    uniqueByProvenance[c.provenance_status] = (uniqueByProvenance[c.provenance_status] ?? 0) + 1;
    const sc = scoredById.get(c.canonical_id);
    if (sc) uniqueByQuality[sc.quality_bucket] = (uniqueByQuality[sc.quality_bucket] ?? 0) + 1;
  }
  const uniqueComposition: Record<string, number | Record<string, number>> = {
    total: uniqueRecords.length,
    unique_legitimate: uniqueRecords.filter((c) => c.curation_status === "KEEP_CANDIDATE").length,
    unique_review: uniqueRecords.filter((c) => c.curation_status === "REVIEW").length,
    unique_remove_candidate: uniqueRecords.filter((c) => c.curation_status === "REMOVE_CANDIDATE").length,
    by_content_type: uniqueByContentType,
    by_license: uniqueByLicense,
    by_quality: uniqueByQuality,
    by_provenance: uniqueByProvenance,
  };

  const qualityBuckets: Record<string, number> = {};
  const beautyDist: Record<string, number> = {};
  const uniqDist: Record<string, number> = {};
  const exprDist: Record<string, number> = {};
  const overallDist: Record<string, number> = {};
  const publication: Record<string, number> = {};
  const curation: Record<string, number> = {};
  const license: Record<string, number> = {};
  const provenance: Record<string, number> = {};

  const records: Record<string, unknown>[] = [];
  for (const c of input.canonical) {
    const ed = editorialById.get(c.canonical_id)!;
    const sc = scoredById.get(c.canonical_id)!;
    qualityBuckets[sc.quality_bucket] = (qualityBuckets[sc.quality_bucket] ?? 0) + 1;
    beautyDist[scoreDistribution(sc.beauty_score_v1)] = (beautyDist[scoreDistribution(sc.beauty_score_v1)] ?? 0) + 1;
    uniqDist[scoreDistribution(sc.uniqueness_score_v1)] = (uniqDist[scoreDistribution(sc.uniqueness_score_v1)] ?? 0) + 1;
    exprDist[scoreDistribution(sc.expressiveness_score_v1)] = (exprDist[scoreDistribution(sc.expressiveness_score_v1)] ?? 0) + 1;
    overallDist[scoreDistribution(sc.overall_score_v1)] = (overallDist[scoreDistribution(sc.overall_score_v1)] ?? 0) + 1;
    publication[c.publication_status] = (publication[c.publication_status] ?? 0) + 1;
    curation[c.curation_status] = (curation[c.curation_status] ?? 0) + 1;
    license[c.license_status] = (license[c.license_status] ?? 0) + 1;
    provenance[c.provenance_status] = (provenance[c.provenance_status] ?? 0) + 1;
    records.push({
      canonical_id: c.canonical_id,
      canonical_content: c.canonical_content,
      normalized_content: c.normalized_content,
      content_type: c.content_type,
      content_type_labels: c.content_type_labels,
      publication_status: c.publication_status,
      curation_status: c.curation_status,
      quality_score_v2: sc.quality_score_v2,
      beauty_score_v1: sc.beauty_score_v1,
      uniqueness_score_v1: sc.uniqueness_score_v1,
      expressiveness_score_v1: sc.expressiveness_score_v1,
      overall_score_v1: sc.overall_score_v1,
      duplicate_group_id: c.duplicate_group_id,
      variant_group_id: c.variant_group_id,
      provenance_status: c.provenance_status,
      license_status: c.license_status,
      source_occurrence_count: c.source_occurrences.length,
      raw_occurrence_count: c.created_from_raw_ids.length,
      is_public: ed.is_public,
      category_confidence: confidenceFor(ed),
      emojiquick_categories: ed.emojiquick_categories.map((x) => x.slug),
    });
  }

  return {
    definition: { ...CANONICAL_CANDIDATE_DEFINITION, count: input.canonical.length },
    primary_content_type: primaryContentType,
    secondary_content_type_labels: secondaryLabels,
    style_primary: stylePrimary,
    style_multi_label_records: styleMultiLabel,
    emotion,
    emotion_confidence: emotionConfidence,
    relationship,
    cute_kawaii: cute,
    animals,
    actions,
    variant_composition: variantComposition,
    variant_canonical_counts: variantCanonicalCounts,
    unique_composition: uniqueComposition,
    quality_buckets: qualityBuckets,
    beauty_distribution: beautyDist,
    uniqueness_distribution: uniqDist,
    expressiveness_distribution: exprDist,
    overall_distribution: overallDist,
    publication,
    curation,
    license,
    provenance,
    public_candidates: input.editorial.filter((e) => e.is_public).length,
    review: input.canonical.filter((c) => c.curation_status === "REVIEW").length,
    remove_candidates: input.canonical.filter((c) => c.curation_status === "REMOVE_CANDIDATE").length,
    duplicate_groups: input.canonical.filter((c) => c.duplicate_group_id).length,
    variant_groups: input.variantGroups.length,
    legitimate_variants: input.variantGroups.filter((v) => v.variant_type !== "category_context").length,
    unique_records: uniqueRecords.length,
    records,
  };
}
