"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ContentPriorityBand } from "@/lib/content/meaning/priority-engine";

export interface CoverageRecordRow {
  readonly slug: string;
  readonly tier: "rich" | "medium" | "structured";
  readonly qualityScore: number;
  readonly priorityBand?: ContentPriorityBand;
  readonly issues: readonly string[];
}

interface ContentCoverageExplorerProps {
  readonly records: readonly CoverageRecordRow[];
}

export function ContentCoverageExplorer({ records }: ContentCoverageExplorerProps) {
  const [tierFilter, setTierFilter] = useState<"all" | "rich" | "medium" | "structured">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | ContentPriorityBand>("all");
  const [qualityFilter, setQualityFilter] = useState<"all" | "weak" | "strong">("all");

  const filtered = useMemo(() => {
    return records.filter((record) => {
      if (tierFilter !== "all" && record.tier !== tierFilter) return false;
      if (priorityFilter !== "all" && record.priorityBand !== priorityFilter) return false;
      if (qualityFilter === "weak" && record.qualityScore >= 70) return false;
      if (qualityFilter === "strong" && record.qualityScore < 70) return false;
      return true;
    });
  }, [records, tierFilter, priorityFilter, qualityFilter]);

  return (
    <section className="card-surface space-y-4 p-6">
      <h2 className="text-xl font-semibold">Filter editorial records</h2>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Tier{" "}
          <select
            className="ml-1 rounded border border-border bg-surface px-2 py-1"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
          >
            <option value="all">All</option>
            <option value="rich">Tier 1 (rich)</option>
            <option value="medium">Tier 2 (medium)</option>
            <option value="structured">Tier 3 (structured-only)</option>
          </select>
        </label>
        <label className="text-sm">
          Priority{" "}
          <select
            className="ml-1 rounded border border-border bg-surface px-2 py-1"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
          >
            <option value="all">All</option>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </label>
        <label className="text-sm">
          Quality{" "}
          <select
            className="ml-1 rounded border border-border bg-surface px-2 py-1"
            value={qualityFilter}
            onChange={(e) => setQualityFilter(e.target.value as typeof qualityFilter)}
          >
            <option value="all">All</option>
            <option value="weak">Weak (&lt;70)</option>
            <option value="strong">Strong (≥70)</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-muted">
        Showing {filtered.length} of {records.length} tracked editorial records
      </p>
      <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
        {filtered.slice(0, 48).map((record) => (
          <li key={record.slug} className="flex flex-wrap items-center gap-2">
            <Link href={`/emoji/${record.slug}`} className="text-accent-strong underline">
              {record.slug}
            </Link>
            <span className="text-muted">
              {record.tier} · score {record.qualityScore}
              {record.priorityBand ? ` · ${record.priorityBand}` : ""}
            </span>
            {record.issues.length > 0 ? (
              <span className="text-xs text-muted">({record.issues.join(", ")})</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
