const fs = require("fs");
const p = "src/lib/kaomoji/processing/phase10/duplicate-audit.ts";
fs.writeFileSync(p, `import type { CanonicalRecord } from "../phase8/types";
import type { DuplicateAuditGroup } from "./types";

export function auditDuplicates(
  canonical: readonly CanonicalRecord[],
  duplicateGroups: readonly { duplicate_group_id: string; members: string[]; relationship_type: string; confidence: string; canonical_id: string }[],
): DuplicateAuditGroup[] {
  const byId = new Map(canonical.map((c) => [c.canonical_id, c]));
  return duplicateGroups.map((g) => {
    const rec = byId.get(g.canonical_id);
    return {
      duplicate_group_id: g.duplicate_group_id,
      canonical_id: g.canonical_id,
      members: g.members,
      relationship_type: g.relationship_type ?? "EXACT",
      confidence: g.confidence ?? "high",
      source_occurrence_count: rec?.source_occurrences.length ?? g.members.length,
    };
  });
}

export function countUniqueCanonical(canonical: readonly CanonicalRecord[]): number {
  return canonical.filter((c) => c.created_from_raw_ids.length === 1).length;
}
`, "utf8");
console.log("fixed duplicate-audit");
