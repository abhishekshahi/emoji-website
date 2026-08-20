import type { Phase7ProcessedRecord, Phase7VariantGroup } from "./types";
import { formattingKey, unicodeEquivalentKey } from "./process-record";

export function analyzeVariants(processed: readonly Phase7ProcessedRecord[]): Phase7VariantGroup[] {
  const formatMap = new Map<string, Phase7ProcessedRecord[]>();
  const unicodeMap = new Map<string, Phase7ProcessedRecord[]>();

  for (const p of processed) {
    const fk = formattingKey(p.original_content);
    formatMap.set(fk, [...(formatMap.get(fk) ?? []), p]);
    const uk = unicodeEquivalentKey(p.original_content);
    unicodeMap.set(uk, [...(unicodeMap.get(uk) ?? []), p]);
  }

  const groups: Phase7VariantGroup[] = [];
  let idx = 0;

  for (const [key, members] of formatMap) {
    const originals = new Set(members.map((m) => m.original_content));
    if (originals.size < 2) continue;
    groups.push({
      variant_group_id: `fmt:${idx++}`,
      variant_type: "formatting_spacing",
      raw_ids: members.map((m) => m.raw_id),
      originals: [...originals],
      confidence: "high",
      reason: `formatting key ${key.slice(0, 40)}`,
    });
  }

  for (const [, members] of unicodeMap) {
    const originals = new Set(members.map((m) => m.original_content));
    if (originals.size < 2) continue;
    const allSameFormat = new Set(members.map((m) => formattingKey(m.original_content))).size === 1;
    if (allSameFormat) continue;
    groups.push({
      variant_group_id: `uni:${idx++}`,
      variant_type: "unicode_representation",
      raw_ids: members.map((m) => m.raw_id),
      originals: [...originals],
      confidence: "medium",
      reason: "unicode equivalent with distinct originals",
    });
  }

  const exactMap = new Map<string, Phase7ProcessedRecord[]>();
  for (const p of processed) {
    exactMap.set(p.original_content, [...(exactMap.get(p.original_content) ?? []), p]);
  }
  for (const [content, members] of exactMap) {
    const cats = new Set(members.map((m) => m.source_category ?? ""));
    if (cats.size < 2) continue;
    groups.push({
      variant_group_id: `cat:${idx++}`,
      variant_type: "category_context",
      raw_ids: members.map((m) => m.raw_id),
      originals: [content],
      confidence: "high",
      reason: "same content in multiple categories",
    });
  }

  return groups;
}
