import { classifyContentType } from "../../universal/content-type";
import { formattingKey, unicodeEquivalentKey } from "../../universal/normalize";
import type { RawKaomojiRecord } from "../../types";
import type {
  Phase7ContentType,
  Phase7PublicationStatus,
  Phase7QualityStatus,
  Phase7ValidationStatus,
} from "./types";
import { normalizeKaomoji } from "../../normalize/normalize";
import { analyzeUnicode } from "./unicode-analyze";
import { getPhase5SourceById } from "../../sources/registry-phase5";
import { PHASE7_NORMALIZATION_VERSION } from "../../storage/paths";

const URL_PATTERN = /https?:\/\/[^\s]+/i;
const HTML_TAG = /<\/?[a-z][\s\S]*?>/i;
const NAV_TEXT = /^(Copied|Copy|Home|Menu|Search|Login|Subscribe|Click here)$/i;

function mapContentType(raw: RawKaomojiRecord): Phase7ContentType[] {
  const types = new Set<Phase7ContentType>();
  const rawType = (raw as { content_type?: string }).content_type;
  if (rawType) {
    const mapped = rawType.toUpperCase().replace(/-/g, "_") as Phase7ContentType;
    types.add(mapped);
  }
  const inferred = classifyContentType({
    content: raw.original_kaomoji,
    source_id: raw.source_id,
    source_category: raw.source_category,
  });
  types.add(inferred.content_type as Phase7ContentType);
  if (inferred.content_type === "DESCRIPTION") types.add("DATA_METADATA");
  if (inferred.content_type === "MEANING") types.add("DATA_METADATA");
  return types.size ? [...types] : ["UNKNOWN"];
}

function validateRecord(
  content: string,
  types: readonly Phase7ContentType[],
): { status: Phase7ValidationStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (!content || content.trim().length === 0) {
    return { status: "INVALID_CANDIDATE", reasons: ["empty"] };
  }
  if (URL_PATTERN.test(content)) return { status: "INVALID_CANDIDATE", reasons: ["contains_url"] };
  if (HTML_TAG.test(content)) return { status: "INVALID_CANDIDATE", reasons: ["contains_html"] };
  if (NAV_TEXT.test(content.trim())) return { status: "INVALID_CANDIDATE", reasons: ["navigation_text"] };
  if (content.length > 200) {
    reasons.push("unusually_long");
    return { status: "REVIEW", reasons };
  }

  const primary = types[0] ?? "UNKNOWN";
  if (primary === "KAOMOJI") return { status: "VALID_KAOMOJI", reasons };
  if (primary === "EMOTICON") return { status: "VALID_EMOTICON", reasons };
  if (primary === "TEXT_FACE") return { status: "VALID_TEXT_FACE", reasons };
  if (primary === "EMOJI" || primary === "EMOJI_SEQUENCE" || primary === "ZWJ_SEQUENCE") {
    return { status: "VALID_EMOJI", reasons };
  }
  if (primary === "SYMBOL") return { status: "VALID_SYMBOL", reasons };
  if (types.includes("ASCII_ART")) return { status: "VALID_ART", reasons };
  if (reasons.length) return { status: "REVIEW", reasons };
  return { status: "REVIEW", reasons: ["uncertain_classification"] };
}

function qualityScore(content: string, validation: Phase7ValidationStatus): { score: number; status: Phase7QualityStatus } {
  if (validation === "INVALID_CANDIDATE") return { score: 0, status: "REJECT_CANDIDATE" };
  let score = 50;
  const len = content.length;
  if (len >= 2 && len <= 80) score += 15;
  if (/[^\w\s]/.test(content)) score += 10;
  if (/\p{Extended_Pictographic}/u.test(content)) score += 5;
  if (/[（）()]/.test(content)) score += 5;
  if (content.trim() !== content) score -= 5;
  if (len > 120) score -= 15;
  if (validation === "REVIEW") score -= 10;
  score = Math.max(0, Math.min(100, score));
  const status: Phase7QualityStatus = score >= 60 ? "KEEP_CANDIDATE" : score >= 35 ? "REVIEW" : "REJECT_CANDIDATE";
  return { score, status };
}

function resolveLicense(raw: RawKaomojiRecord): import("../../types").LicenseStatus {
  const source = getPhase5SourceById(raw.source_id);
  return raw.license_status ?? source?.license_status ?? "UNKNOWN";
}

export function resolvePublicationStatus(
  validation: Phase7ValidationStatus,
  license: import("../../types").LicenseStatus,
): Phase7PublicationStatus {
  if (validation === "INVALID_CANDIDATE") return "INVALID_CANDIDATE";
  if (license === "NOT_PERMITTED") return "BLOCKED";
  if (license === "REVIEW_REQUIRED" || license === "UNKNOWN") return "REVIEW_REQUIRED";
  if (license === "ATTRIBUTION_REQUIRED") return "PUBLISH_WITH_ATTRIBUTION";
  if (validation === "REVIEW") return "REVIEW_REQUIRED";
  return "PUBLISH_CANDIDATE";
}

function extractMetadata(raw: RawKaomojiRecord): {
  caption: string | null;
  description: string | null;
  label: string | null;
  tags: string[];
  keywords: string[];
} {
  let caption: string | null = null;
  let description: string | null = null;
  if (raw.raw_html_context_if_needed) {
    try {
      const meta = JSON.parse(raw.raw_html_context_if_needed) as Record<string, unknown>;
      if (typeof meta.caption === "string") caption = meta.caption;
      if (typeof meta.annotation === "string") description = meta.annotation;
      if (typeof meta.description === "string") description = meta.description;
    } catch {
      /* not json */
    }
  }
  const tags = raw.source_category ? [raw.source_category] : [];
  const keywords = raw.source_title ? [raw.source_title] : [];
  return { caption, description, label: raw.source_title, tags, keywords };
}

export interface ProcessedRecordResult {
  readonly normalized: {
    raw_id: string;
    original_content: string;
    normalized_content: string;
    normalization_version: string;
    normalization_changes: readonly { kind: string; before: string; after: string }[];
    normalization_warnings: readonly string[];
  };
  readonly processed: import("./types").Phase7ProcessedRecord;
  readonly keys: {
    exact: string;
    unicode: string;
    normalized: string;
    formatting: string;
    category: string;
  };
}

/** Process one RAW record into derived normalized + analysis fields. */
export function processRawRecord(raw: RawKaomojiRecord): ProcessedRecordResult {
  const original = raw.original_kaomoji;
  const norm = normalizeKaomoji(original);
  const contentTypes = mapContentType(raw);
  const validation = validateRecord(norm.normalized_kaomoji, contentTypes);
  const unicode = analyzeUnicode(original);
  const quality = qualityScore(norm.normalized_kaomoji, validation.status);
  const license = resolveLicense(raw);
  const publication = resolvePublicationStatus(validation.status, license);
  const meta = extractMetadata(raw);

  const symmetry = /(\(|\[|（|【).+(\)|\]|）|】)/u.test(original) ? 0.7 : null;

  return {
    normalized: {
      raw_id: raw.raw_id,
      original_content: original,
      normalized_content: norm.normalized_kaomoji,
      normalization_version: PHASE7_NORMALIZATION_VERSION,
      normalization_changes: norm.normalization_changes,
      normalization_warnings: norm.normalization_warnings,
    },
    processed: {
      raw_id: raw.raw_id,
      source_id: raw.source_id,
      source_record_id: raw.source_record_id,
      source_url: raw.source_url,
      source_page: raw.source_page,
      source_file: null,
      source_category: raw.source_category,
      original_content: original,
      normalized_content: norm.normalized_kaomoji,
      content_types: contentTypes,
      validation_status: validation.status,
      validation_reasons: validation.reasons,
      unicode,
      quality_score: quality.score,
      quality_status: quality.status,
      beauty_foundation: {
        symmetry,
        visual_balance: null,
        expressiveness: quality.score > 70 ? 0.6 : null,
        aesthetic_score: null,
      },
      license_status: license,
      publication_status: publication,
      source_keywords: meta.keywords,
      source_tags: meta.tags,
      source_description: meta.description,
      source_caption: meta.caption,
      source_label: meta.label,
      provenance: [...raw.provenance],
    },
    keys: {
      exact: original,
      unicode: unicodeEquivalentKey(original),
      normalized: norm.normalized_kaomoji,
      formatting: formattingKey(original),
      category: `${raw.source_id}:${raw.source_category ?? ""}:${formattingKey(original)}`,
    },
  };
}

export { formattingKey, unicodeEquivalentKey };
