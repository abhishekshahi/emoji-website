import { createHash } from "node:crypto";
import type { LicenseStatus, RawKaomojiRecord } from "../../types";
import type {
  CanonicalRecord,
  CurationStatus,
  PublicationStatus,
  QualityTier,
  RepairedProvenance,
  SourceOccurrence,
  VariantType,
} from "./types";
import { PHASE8_CANONICAL_ID_VERSION } from "../../storage/paths";

export function buildCanonicalId(normalizedContent: string): string {
  return `kao_${createHash("sha256").update(normalizedContent, "utf8").digest("hex").slice(0, 16)}`;
}

interface Phase7RecordMeta {
  readonly validation_status: string;
  readonly validation_reasons: readonly string[];
  readonly content_types: readonly string[];
  readonly quality_score: number;
  readonly quality_status: string;
  readonly license_status: LicenseStatus;
  readonly publication_status: string;
}

function qualityTier(score: number, validation: string): QualityTier {
  if (validation === "INVALID_CANDIDATE" || validation === "REVIEW") return "REVIEW";
  if (score >= 80) return "HIGH";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "MEDIUM";
  if (score >= 20) return "LOW";
  return "REVIEW";
}

function resolvePublication(validation: string, license: LicenseStatus, provStatus: string): PublicationStatus {
  if (validation === "INVALID_CANDIDATE") return "REMOVE_CANDIDATE";
  if (license === "NOT_PERMITTED") return "BLOCKED";
  if (license === "REVIEW_REQUIRED" || license === "UNKNOWN") return "REVIEW_REQUIRED";
  if (license === "ATTRIBUTION_REQUIRED") return "PUBLISH_WITH_ATTRIBUTION";
  if (validation === "REVIEW" || provStatus === "PROVENANCE_UNRESOLVED" || provStatus === "CONFLICTING") {
    return "REVIEW_REQUIRED";
  }
  return "PUBLISH_CANDIDATE";
}

function resolveCuration(
  validation: string,
  publication: PublicationStatus,
  provStatus: string,
  nearDup: boolean,
): CurationStatus {
  if (validation === "INVALID_CANDIDATE" || publication === "REMOVE_CANDIDATE") return "REMOVE_CANDIDATE";
  if (
    validation === "REVIEW" ||
    publication === "REVIEW_REQUIRED" ||
    publication === "BLOCKED" ||
    provStatus === "CONFLICTING" ||
    provStatus === "PROVENANCE_UNRESOLVED" ||
    nearDup
  ) {
    return "REVIEW";
  }
  return "KEEP_CANDIDATE";
}

function representativeScore(
  raw: RawKaomojiRecord,
  repaired: RepairedProvenance,
  meta: Phase7RecordMeta,
): number {
  let score = meta.quality_score;
  if (meta.validation_status.startsWith("VALID_")) score += 100;
  if (repaired.status === "COMPLETE") score += 50;
  else if (repaired.status === "PARTIAL") score += 25;
  if (meta.license_status === "APPROVED") score += 40;
  else if (meta.license_status === "ATTRIBUTION_REQUIRED") score += 30;
  if (raw.source_record_id) score += 10;
  if (raw.source_page) score += 5;
  score -= new Date(raw.collection_timestamp).getTime() / 1e15;
  return score;
}

function primaryContentType(types: readonly string[]): string {
  const priority = ["KAOMOJI", "EMOTICON", "TEXT_FACE", "EMOJI", "EMOJI_SEQUENCE", "SYMBOL", "OTHER"];
  for (const p of priority) {
    if (types.includes(p)) return p;
  }
  return types[0] ?? "REVIEW";
}

function inferVariantType(variantType: string | undefined): VariantType {
  if (!variantType) return "OTHER_VARIANT";
  if (variantType.includes("formatting") || variantType.includes("spacing")) return "SPACING_VARIANT";
  if (variantType.includes("unicode")) return "UNICODE_VARIANT";
  if (variantType.includes("category")) return "EMOTION_VARIANT";
  return "OTHER_VARIANT";
}

export interface BuildCanonicalInput {
  readonly rawRecords: readonly RawKaomojiRecord[];
  readonly normalizedByRawId: Map<string, string>;
  readonly metaByRawId: Map<string, Phase7RecordMeta>;
  readonly repairedByRawId: Map<string, RepairedProvenance>;
  readonly variantGroupByRawId: Map<string, { group_id: string; variant_type: string }>;
  readonly nearDuplicateRawIds: Set<string>;
}

export interface BuildCanonicalResult {
  readonly canonicalRecords: readonly CanonicalRecord[];
  readonly rawToCanonical: Map<string, string>;
  readonly duplicateGroups: readonly {
    duplicate_group_id: string;
    members: string[];
    relationship_type: string;
    confidence: string;
    reason: string;
    canonical_id: string;
  }[];
}

export function buildCanonicalLibrary(input: BuildCanonicalInput): BuildCanonicalResult {
  const groups = new Map<string, RawKaomojiRecord[]>();

  for (const raw of input.rawRecords) {
    const norm = input.normalizedByRawId.get(raw.raw_id) ?? raw.original_kaomoji;
    const list = groups.get(norm) ?? [];
    list.push(raw);
    groups.set(norm, list);
  }

  const canonicalRecords: CanonicalRecord[] = [];
  const rawToCanonical = new Map<string, string>();
  const duplicateGroups: BuildCanonicalResult["duplicateGroups"][number][] = [];

  for (const [normalized, members] of groups) {
    const canonicalId = buildCanonicalId(normalized);
    const duplicateGroupId = members.length > 1 ? `dup:exact:${canonicalId}` : null;

    let best = members[0]!;
    let bestScore = -Infinity;
    for (const m of members) {
      const repaired = input.repairedByRawId.get(m.raw_id)!;
      const meta = input.metaByRawId.get(m.raw_id)!;
      const s = representativeScore(m, repaired, meta);
      if (s > bestScore || (s === bestScore && m.raw_id < best.raw_id)) {
        bestScore = s;
        best = m;
      }
    }

    const repMeta = input.metaByRawId.get(best.raw_id)!;
    const repRepaired = input.repairedByRawId.get(best.raw_id)!;
    const variantInfo = input.variantGroupByRawId.get(best.raw_id);

    const sourceOccurrences: SourceOccurrence[] = members.map((m) => {
      const repaired = input.repairedByRawId.get(m.raw_id)!;
      return {
        raw_id: m.raw_id,
        source_id: m.source_id,
        source_record_id: m.source_record_id,
        source_url: m.source_url,
        source_page: m.source_page,
        source_category: m.source_category,
        source_file: null,
        collection_timestamp: m.collection_timestamp,
        license_status: m.license_status,
        provenance_status: repaired.status,
      };
    });

    const sourceCategories = [...new Set(members.map((m) => m.source_category).filter(Boolean))] as string[];
    const nearDup = members.some((m) => input.nearDuplicateRawIds.has(m.raw_id));
    const publication = resolvePublication(repMeta.validation_status, repMeta.license_status, repRepaired.status);
    const curation = resolveCuration(repMeta.validation_status, publication, repRepaired.status, nearDup);

    const worstProv = members.reduce<RepairedProvenance["status"]>((worst, m) => {
      const s = input.repairedByRawId.get(m.raw_id)!.status;
      const order = ["MISSING", "PROVENANCE_UNRESOLVED", "CONFLICTING", "PARTIAL", "COMPLETE"];
      return order.indexOf(s) < order.indexOf(worst) ? s : worst;
    }, "COMPLETE");

    canonicalRecords.push({
      canonical_id: canonicalId,
      canonical_content: best.original_kaomoji,
      normalized_content: normalized,
      content_type: primaryContentType(repMeta.content_types),
      content_type_labels: repMeta.content_types,
      duplicate_group_id: duplicateGroupId,
      variant_group_id: variantInfo?.group_id ?? null,
      variant_type: variantInfo ? inferVariantType(variantInfo.variant_type) : null,
      source_occurrences: sourceOccurrences,
      provenance_status: worstProv,
      quality_score: repMeta.quality_score,
      quality_status: qualityTier(repMeta.quality_score, repMeta.validation_status),
      quality_reasons: [...repMeta.validation_reasons],
      license_status: repMeta.license_status,
      publication_status: publication,
      curation_status: curation,
      confidence: repRepaired.status === "COMPLETE" && repMeta.validation_status.startsWith("VALID_") ? "high" : "medium",
      representative_raw_id: best.raw_id,
      created_from_raw_ids: members.map((m) => m.raw_id),
      source_categories: sourceCategories,
      emojiquick_category_candidates: [...sourceCategories],
      popularity_status: "DATA_NOT_AVAILABLE",
      near_duplicate_review: nearDup,
    });

    for (const m of members) {
      rawToCanonical.set(m.raw_id, canonicalId);
    }

    if (members.length > 1) {
      duplicateGroups.push({
        duplicate_group_id: duplicateGroupId!,
        members: members.map((m) => m.raw_id),
        relationship_type: "EXACT",
        confidence: "high",
        reason: "identical normalized_content",
        canonical_id: canonicalId,
      });
    }
  }

  canonicalRecords.sort((a, b) => a.canonical_id.localeCompare(b.canonical_id));
  return { canonicalRecords, rawToCanonical, duplicateGroups };
}

export { PHASE8_CANONICAL_ID_VERSION };
