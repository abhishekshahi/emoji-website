import type { Phase7DuplicateGroup, Phase7DuplicateKind, Phase7ProcessedRecord } from "./types";

interface IndexEntry {
  raw_id: string;
  source_id: string;
  source_category: string | null;
  original: string;
  normalized: string;
}

function buildIndex(processed: readonly Phase7ProcessedRecord[]): IndexEntry[] {
  return processed.map((p) => ({
    raw_id: p.raw_id,
    source_id: p.source_id,
    source_category: p.source_category,
    original: p.original_content,
    normalized: p.normalized_content,
  }));
}

function groupBy(
  entries: IndexEntry[],
  keyFn: (e: IndexEntry) => string,
): Map<string, IndexEntry[]> {
  const map = new Map<string, IndexEntry[]>();
  for (const e of entries) {
    const k = keyFn(e);
    const list = map.get(k) ?? [];
    list.push(e);
    map.set(k, list);
  }
  return map;
}

function toGroup(
  kind: Phase7DuplicateKind,
  key: string,
  members: IndexEntry[],
  reason: string,
  confidence: "high" | "medium" | "low",
): Phase7DuplicateGroup {
  return {
    group_id: `${kind}:${key.slice(0, 64)}:${members.length}`,
    kind,
    key,
    raw_ids: members.map((m) => m.raw_id),
    source_ids: [...new Set(members.map((m) => m.source_id))],
    categories: [...new Set(members.map((m) => m.source_category).filter(Boolean))] as string[],
    count: members.length,
    confidence,
    reason,
  };
}

export interface DuplicateAnalysisResult {
  readonly groups: readonly Phase7DuplicateGroup[];
  readonly counts: Record<Phase7DuplicateKind, number>;
  readonly relationship_count: number;
}

/** Analysis-only duplicate detection — no deletion or merging. */
export function analyzeDuplicates(processed: readonly Phase7ProcessedRecord[]): DuplicateAnalysisResult {
  const entries = buildIndex(processed);
  const groups: Phase7DuplicateGroup[] = [];
  const counts: Record<Phase7DuplicateKind, number> = {
    EXACT: 0,
    UNICODE_EQUIVALENT: 0,
    NORMALIZED: 0,
    FORMATTING: 0,
    CROSS_SOURCE: 0,
    SAME_SOURCE: 0,
    CATEGORY_DUPLICATE: 0,
    NEAR_DUPLICATE: 0,
  };

  const exactGroups = groupBy(entries, (e) => e.original);
  for (const [key, members] of exactGroups) {
    if (members.length < 2) continue;
    groups.push(toGroup("EXACT", key, members, "identical original_content", "high"));
    counts.EXACT += members.length;
    const sources = new Set(members.map((m) => m.source_id));
    if (sources.size > 1) {
      groups.push(toGroup("CROSS_SOURCE", key, members, "exact match across sources", "high"));
      counts.CROSS_SOURCE += members.length;
    } else {
      groups.push(toGroup("SAME_SOURCE", key, members, "exact match within source", "high"));
      counts.SAME_SOURCE += members.length;
    }
    const categories = new Set(members.map((m) => `${m.source_id}:${m.source_category ?? ""}`));
    if (categories.size > 1) {
      groups.push(toGroup("CATEGORY_DUPLICATE", key, members, "same content different category", "high"));
      counts.CATEGORY_DUPLICATE += members.length;
    }
  }

  const unicodeGroups = groupBy(entries, (e) => e.original.normalize("NFKC"));
  for (const [key, members] of unicodeGroups) {
    if (members.length < 2) continue;
    const distinctOriginal = new Set(members.map((m) => m.original));
    if (distinctOriginal.size < 2) continue;
    groups.push(toGroup("UNICODE_EQUIVALENT", key, members, "NFKC equivalent", "high"));
    counts.UNICODE_EQUIVALENT += members.length;
  }

  const normalizedGroups = groupBy(entries, (e) => e.normalized);
  for (const [key, members] of normalizedGroups) {
    if (members.length < 2) continue;
    const distinctOriginal = new Set(members.map((m) => m.original));
    if (distinctOriginal.size < 2) continue;
    groups.push(toGroup("NORMALIZED", key, members, "normalized_content match", "high"));
    counts.NORMALIZED += members.length;
  }

  const formatGroups = groupBy(entries, (e) => e.original.replace(/\s+/g, ""));
  for (const [key, members] of formatGroups) {
    if (members.length < 2) continue;
    const distinctOriginal = new Set(members.map((m) => m.original));
    if (distinctOriginal.size < 2) {
      continue;
    }
    groups.push(toGroup("FORMATTING", key, members, "whitespace/formatting difference only", "medium"));
    counts.FORMATTING += members.length;
  }

  // Near duplicate: bucket by length + prefix (count only for large buckets)
  const nearBuckets = groupBy(entries, (e) => `${e.original.length}:${e.original.slice(0, 4)}`);
  for (const [, members] of nearBuckets) {
    if (members.length < 2 || members.length > 20) continue;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i]!;
        const b = members[j]!;
        if (a.original === b.original) continue;
        if (Math.abs(a.original.length - b.original.length) > 2) continue;
        let diff = 0;
        const maxLen = Math.max(a.original.length, b.original.length);
        for (let k = 0; k < maxLen; k++) {
          if ((a.original[k] ?? "") !== (b.original[k] ?? "")) diff++;
        }
        if (diff <= 2) {
          counts.NEAR_DUPLICATE += 2;
          if (groups.filter((g) => g.kind === "NEAR_DUPLICATE").length < 5000) {
            groups.push(
              toGroup("NEAR_DUPLICATE", `${a.original}|${b.original}`, [a, b], "small edit distance", "low"),
            );
          }
        }
      }
    }
  }

  return { groups, counts, relationship_count: groups.reduce((s, g) => s + g.count, 0) };
}
