import { CLASSIFICATION_VERSION } from "../storage/paths";
import type {
  AggregatedKaomojiRecord,
  ClassificationLabel,
  MergeDecision,
  SourceRef,
  ValidationRecord,
} from "../types";

const URL_PATTERN = /https?:\/\/[^\s]+/i;
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*?>/i;
const SPAM_PATTERN = /(.)\1{20,}|(?:click here|buy now|subscribe now|free money)/i;

export interface ClassifyInput {
  readonly aggregated_id: string;
  readonly normalized_kaomoji: string;
  readonly source_refs: readonly SourceRef[];
}

/** Classify a normalized kaomoji candidate. Unusual forms stay VALID or REVIEW. */
export function classifyCandidate(input: ClassifyInput): ValidationRecord {
  const { aggregated_id, normalized_kaomoji, source_refs } = input;
  const reasons: string[] = [];
  let classification: ClassificationLabel = "VALID_CANDIDATE";

  if (!normalized_kaomoji || normalized_kaomoji.trim().length === 0) {
    classification = "INVALID_CANDIDATE";
    reasons.push("empty");
  } else if (URL_PATTERN.test(normalized_kaomoji)) {
    classification = "INVALID_CANDIDATE";
    reasons.push("contains_url");
  } else if (HTML_TAG_PATTERN.test(normalized_kaomoji)) {
    classification = "INVALID_CANDIDATE";
    reasons.push("contains_html_tag");
  } else if (SPAM_PATTERN.test(normalized_kaomoji)) {
    classification = "INVALID_CANDIDATE";
    reasons.push("spam_pattern");
  } else if (normalized_kaomoji.length > 200) {
    classification = "REVIEW";
    reasons.push("unusually_long");
  }

  const decision: MergeDecision = classification === "INVALID_CANDIDATE" ? "flagged" : "kept";

  return {
    aggregated_id,
    classification,
    reasons,
    decision,
    decision_version: CLASSIFICATION_VERSION,
    target_record: null,
    source_refs,
  };
}

/** Classify all aggregated records using their candidate_key as normalized form. */
export function classifyAggregatedRecords(
  records: readonly AggregatedKaomojiRecord[],
): ValidationRecord[] {
  return records.map((record) =>
    classifyCandidate({
      aggregated_id: record.aggregated_id,
      normalized_kaomoji: record.candidate_key,
      source_refs: record.source_refs,
    }),
  );
}
