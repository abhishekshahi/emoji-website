import type { UniversalContentType } from "../types";

const EMOJI_SEQUENCE = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})+/u;
const FLAG_SEQUENCE = /\p{Regional_Indicator}{2}/u;
const ZWJ_SEQUENCE = /\p{Extended_Pictographic}\u200D\p{Extended_Pictographic}/u;
const KEYCAP = /\d\uFE0F?\u20E3/u;
const KAOMOJI_HINT = /[（）(）][\s\S]*[（）(）]|[╭╮╯╰┌┐└┘]/u;
const EMOTICON_HINT = /^[:;=8xX][\-~^]?[)(DPpOo3\\\/\][|][\s\S]*$/u;

export interface ContentTypeInput {
  readonly content: string;
  readonly source_id: string;
  readonly source_category: string | null;
  readonly override_type?: UniversalContentType;
}

export interface ContentTypeResult {
  readonly content_type: UniversalContentType;
  readonly source_content_type: UniversalContentType;
  readonly confidence: "high" | "medium" | "low";
}

function inferFromSource(sourceId: string, category: string | null): UniversalContentType | null {
  if (sourceId === "kaomoji-tagged" || sourceId === "kaomojis-org") return "KAOMOJI";
  if (sourceId === "emoticon-data" || sourceId === "textemoticons" || sourceId === "emoticonstext") {
    return "EMOTICON";
  }
  if (category?.toLowerCase().includes("kaomoji")) return "KAOMOJI";
  if (category?.toLowerCase().includes("emoticon")) return "EMOTICON";
  return null;
}

/** Reversible content-type classification; preserves source classification separately. */
export function classifyContentType(input: ContentTypeInput): ContentTypeResult {
  if (input.override_type) {
    return {
      content_type: input.override_type,
      source_content_type: input.override_type,
      confidence: "high",
    };
  }

  const { content, source_id, source_category } = input;
  const sourceHint = inferFromSource(source_id, source_category);

  if (FLAG_SEQUENCE.test(content)) {
    return { content_type: "FLAG", source_content_type: sourceHint ?? "FLAG", confidence: "high" };
  }
  if (KEYCAP.test(content)) {
    return { content_type: "KEYCAP", source_content_type: sourceHint ?? "KEYCAP", confidence: "high" };
  }
  if (ZWJ_SEQUENCE.test(content)) {
    return { content_type: "ZWJ_SEQUENCE", source_content_type: sourceHint ?? "ZWJ_SEQUENCE", confidence: "high" };
  }
  if (EMOJI_SEQUENCE.test(content)) {
    return {
      content_type: "EMOJI_SEQUENCE",
      source_content_type: sourceHint ?? "EMOJI_SEQUENCE",
      confidence: "medium",
    };
  }
  if (KAOMOJI_HINT.test(content)) {
    return { content_type: "KAOMOJI", source_content_type: sourceHint ?? "KAOMOJI", confidence: "high" };
  }
  if (EMOTICON_HINT.test(content.trim())) {
    return { content_type: "EMOTICON", source_content_type: sourceHint ?? "EMOTICON", confidence: "medium" };
  }
  if (sourceHint) {
    return { content_type: sourceHint, source_content_type: sourceHint, confidence: "medium" };
  }

  return { content_type: "TEXT_FACE", source_content_type: "OTHER", confidence: "low" };
}
