import { CLASSIFICATION_VERSION } from "../storage/paths";
import type {
  AggregatedSourceItem,
  UniversalValidationLabel,
  UniversalValidationRecord,
} from "../types";

const URL_PATTERN = /https?:\/\/[^\s]+/i;
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*?>/i;
const SPAM_PATTERN = /(.)\1{20,}|(?:click here|buy now|subscribe now|free money)/i;

function mapClassification(label: UniversalValidationLabel): UniversalValidationLabel {
  return label;
}

/** Validate universal aggregated items; preserve unusual content as VALID or REVIEW. */
export function validateAggregatedItem(item: AggregatedSourceItem): UniversalValidationRecord {
  const content = item.canonical_candidate;
  const reasons: string[] = [];
  let classification: UniversalValidationLabel = "VALID";

  if (!content || content.trim().length === 0) {
    classification = "INVALID";
    reasons.push("empty");
  } else if (URL_PATTERN.test(content)) {
    classification = "INVALID";
    reasons.push("contains_url");
  } else if (HTML_TAG_PATTERN.test(content)) {
    classification = "INVALID";
    reasons.push("contains_html_tag");
  } else if (SPAM_PATTERN.test(content)) {
    classification = "INVALID";
    reasons.push("spam_pattern");
  } else if (content.length > 200) {
    classification = "REVIEW";
    reasons.push("unusually_long");
  } else if (item.publication_status === "PUBLICATION_BLOCKED") {
    classification = "REVIEW";
    reasons.push("publication_blocked");
  }

  return {
    aggregated_id: item.aggregated_id,
    classification: mapClassification(classification),
    reasons,
    source_item_ids: item.source_refs.map((r) => r.source_item_id),
  };
}

export function validateAggregatedItems(
  items: readonly AggregatedSourceItem[],
): UniversalValidationRecord[] {
  return items.map(validateAggregatedItem);
}

export { CLASSIFICATION_VERSION };
