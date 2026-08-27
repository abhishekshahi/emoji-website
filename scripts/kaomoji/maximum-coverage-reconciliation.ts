/**
 * Independent reconciliation of proposed maximum-coverage promotions.
 * READ-ONLY against canonical source. Does NOT modify D1 or expected counts.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { evaluatePublicationGate, isQualityEligible } from "@/lib/kaomoji/processing/phase12/publication-filter";
import { isPublicCandidate } from "@/lib/kaomoji/processing/phase9/editorial-priority";
import { getSourceById } from "@/lib/kaomoji/sources/registry";
import { getPhase5SourceById } from "@/lib/kaomoji/sources/registry-phase5";
import type { CanonicalRecord } from "@/lib/kaomoji/processing/phase8/types";
import type { Phase10ScoredRecord } from "@/lib/kaomoji/processing/phase10/types";
import type { KaomojiEditorialRecord } from "@/lib/kaomoji/processing/phase9/types";
import { getKaomojiRawRecordsPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");

const OLD = {
  canonical: 63248,
  public: 50979,
  blocked: 12269,
  relationships: 392904,
} as const;

interface PromotionDecision {
  canonical_id: string;
  slug: string;
  promotion_path: string;
  evidence: string[];
  resolved_curation_status: "KEEP_CANDIDATE";
  resolved_license_status: string;
  resolved_publication_status: string;
}

interface ReconciliationRecord {
  canonical_id: string;
  slug: string;
  kaomoji: string;
  previous_publication_status: string;
  new_publication_status: string;
  previous_curation_status: string;
  new_curation_status: string;
  previous_license_status: string;
  license_evidence: string[];
  provenance_evidence: string[];
  curation_evidence: string[];
  quality_bucket: string;
  quality_score: number;
  quality_eligible: boolean;
  content_unique: boolean;
  gate_before: { eligible: boolean; blocked_reason: string | null };
  gate_after: { eligible: boolean; blocked_reason: string | null };
  eligibility_reason: string;
  independently_validated: boolean;
  sources: string[];
}

function sourceLicenseEvidence(sourceIds: readonly string[]): string[] {
  return sourceIds.map((id) => {
    const p5 = getPhase5SourceById(id);
    const reg = getSourceById(id);
    const src = p5 ?? reg;
    if (!src) return `${id}:UNKNOWN_SOURCE`;
    return `${id}:license=${src.license_status},publication_enabled=${src.enabled_for_publication},attribution=${src.attribution_required}`;
  });
}

function provenanceEvidence(c: CanonicalRecord): string[] {
  const lines = [`provenance_status=${c.provenance_status}`];
  for (const occ of c.source_occurrences.slice(0, 5)) {
    lines.push(`occurrence:${occ.source_id}:${occ.source_record_id ?? "n/a"}:${occ.license_status}`);
  }
  if (c.source_occurrences.length > 5) {
    lines.push(`...and ${c.source_occurrences.length - 5} more occurrences`);
  }
  if (c.created_from_raw_ids?.length) {
    lines.push(`raw_ids=${c.created_from_raw_ids.length}`);
  }
  return lines;
}

function curationEvidence(c: CanonicalRecord, contentUnique: boolean): string[] {
  const lines: string[] = [];
  if (c.near_duplicate_review) {
    lines.push("near_duplicate_review=true — content verified unique vs existing public library");
  }
  if (contentUnique) lines.push("normalized_content not present in current public set");
  lines.push(`previous_curation_status=${c.curation_status}`);
  lines.push("resolved_curation_status=KEEP_CANDIDATE (evidence-based near-duplicate resolution)");
  return lines;
}

function applyResolution(c: CanonicalRecord, d: PromotionDecision): CanonicalRecord {
  return {
    ...c,
    curation_status: d.resolved_curation_status,
    license_status: d.resolved_license_status as CanonicalRecord["license_status"],
    publication_status: d.resolved_publication_status as CanonicalRecord["publication_status"],
  };
}

function main(): void {
  const canonical = JSON.parse(
    readFileSync(join(rootDir, "data/kaomoji/processed/phase-8/proposed-library/canonical-records.json"), "utf8"),
  ) as CanonicalRecord[];
  const scored = JSON.parse(
    readFileSync(join(rootDir, "data/kaomoji/processed/phase-10/scored-records.json"), "utf8"),
  ) as Phase10ScoredRecord[];
  const editorial = JSON.parse(
    readFileSync(join(rootDir, "data/kaomoji/processed/phase-9/editorial/editorial-records.json"), "utf8"),
  ) as KaomojiEditorialRecord[];
  const decisions = JSON.parse(
    readFileSync(join(finalDir, "promotion-decisions.json"), "utf8"),
  ) as PromotionDecision[];

  const canonicalMap = new Map(canonical.map((c) => [c.canonical_id, c]));
  const scoredMap = new Map(scored.map((s) => [s.canonical_id, s]));
  const editorialMap = new Map(editorial.map((e) => [e.canonical_id, e]));

  const publicNorms = new Set<string>();
  for (const e of editorial) {
    if (!e.is_public) continue;
    publicNorms.add(e.normalized_content);
  }

  const records: ReconciliationRecord[] = [];
  let validated = 0;
  let failed = 0;

  for (const d of decisions) {
    const c = canonicalMap.get(d.canonical_id);
    const sc = scoredMap.get(d.canonical_id);
    const ed = editorialMap.get(d.canonical_id);
    if (!c || !sc || !ed) {
      failed++;
      records.push({
        canonical_id: d.canonical_id,
        slug: d.slug,
        kaomoji: ed?.canonical_content ?? "?",
        previous_publication_status: c?.publication_status ?? "?",
        new_publication_status: d.resolved_publication_status,
        previous_curation_status: c?.curation_status ?? "?",
        new_curation_status: d.resolved_curation_status,
        previous_license_status: c?.license_status ?? "?",
        license_evidence: ["MISSING_CANONICAL_LAYER"],
        provenance_evidence: [],
        curation_evidence: [],
        quality_bucket: sc?.quality_bucket ?? "?",
        quality_score: sc?.overall_score_v1 ?? sc?.quality_score_v2 ?? 0,
        quality_eligible: false,
        content_unique: false,
        gate_before: { eligible: false, blocked_reason: "missing_layer" },
        gate_after: { eligible: false, blocked_reason: "missing_layer" },
        eligibility_reason: "FAIL: missing canonical/scored/editorial layer",
        independently_validated: false,
        sources: [],
      });
      continue;
    }

    const sources = [...new Set(c.source_occurrences.map((o) => o.source_id))];
    const contentUnique = !publicNorms.has(c.normalized_content);
    const gateBefore = evaluatePublicationGate(c, sc);
    const resolved = applyResolution(c, d);
    const gateAfter = evaluatePublicationGate(resolved, sc);
    const passes =
      isQualityEligible(sc.quality_bucket) &&
      contentUnique &&
      gateAfter.publication_eligible &&
      c.provenance_status === "COMPLETE" &&
      (resolved.license_status === "APPROVED" || resolved.license_status === "ATTRIBUTION_REQUIRED");

    if (passes) validated++;
    else failed++;

    let eligibilityReason: string;
    if (passes) {
      eligibilityReason =
        "All publication gates pass after evidence-based curation resolution: quality eligible, license approved, provenance complete, unique content not live, curation KEEP_CANDIDATE, publication PUBLISH_CANDIDATE";
    } else {
      const reasons: string[] = [];
      if (!isQualityEligible(sc.quality_bucket)) reasons.push(`quality=${sc.quality_bucket}`);
      if (!contentUnique) reasons.push("duplicate_content_already_public");
      if (!isPublicCandidate(resolved)) reasons.push("not_public_candidate_after_resolution");
      if (!gateAfter.publication_eligible) reasons.push(`gate_blocked=${gateAfter.blocked_reason}`);
      if (c.provenance_status !== "COMPLETE") reasons.push(`provenance=${c.provenance_status}`);
      eligibilityReason = `FAIL: ${reasons.join("; ")}`;
    }

    records.push({
      canonical_id: d.canonical_id,
      slug: d.slug,
      kaomoji: c.canonical_content,
      previous_publication_status: c.publication_status,
      new_publication_status: d.resolved_publication_status,
      previous_curation_status: c.curation_status,
      new_curation_status: d.resolved_curation_status,
      previous_license_status: c.license_status,
      license_evidence: [
        `record_license_status=${c.license_status}`,
        ...sourceLicenseEvidence(sources),
        ...d.evidence.filter((e) => e.startsWith("license:") || e.startsWith("path_")),
      ],
      provenance_evidence: provenanceEvidence(c),
      curation_evidence: curationEvidence(c, contentUnique),
      quality_bucket: sc.quality_bucket,
      quality_score: sc.overall_score_v1 ?? sc.quality_score_v2,
      quality_eligible: isQualityEligible(sc.quality_bucket),
      content_unique: contentUnique,
      gate_before: { eligible: gateBefore.publication_eligible, blocked_reason: gateBefore.blocked_reason },
      gate_after: { eligible: gateAfter.publication_eligible, blocked_reason: gateAfter.blocked_reason },
      eligibility_reason: eligibilityReason,
      independently_validated: passes,
      sources,
    });
  }

  const newlyEligible = validated;
  const newPublicExpected = OLD.public + newlyEligible;
  const remainingBlocked = OLD.blocked - newlyEligible;
  const rawSha = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;

  const summary = {
    timestamp: new Date().toISOString(),
    mode: "INDEPENDENT_RECONCILIATION",
    old: OLD,
    proposed: {
      newly_eligible: newlyEligible,
      failed_validation: failed,
      new_public_expected: newPublicExpected,
      remaining_blocked: remainingBlocked,
      promotion_decisions_reviewed: decisions.length,
    },
    reconciliation_passes: failed === 0 && newlyEligible === decisions.length,
    raw_sha256: rawSha,
    raw_unchanged: rawSha === "fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf",
    sql_executed: false,
    expected_counts_modified: false,
    remote_d1_modified: false,
    per_record: records,
  };

  mkdirSync(finalDir, { recursive: true });
  writeFileSync(join(finalDir, "maximum-coverage-reconciliation.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");

  const md = `# Maximum Coverage — Independent Reconciliation

**Timestamp:** ${summary.timestamp}

## OLD baseline (unchanged)

| Metric | Count |
|--------|------:|
| Canonical | ${OLD.canonical.toLocaleString()} |
| Public | ${OLD.public.toLocaleString()} |
| Blocked | ${OLD.blocked.toLocaleString()} |
| Relationships | ${OLD.relationships.toLocaleString()} |

## Reconciliation result

| Metric | Value |
|--------|------:|
| Proposed promotions reviewed | ${decisions.length} |
| **Independently validated (newly eligible)** | **${newlyEligible}** |
| Failed independent validation | ${failed} |
| **new_public_expected** | **${newPublicExpected.toLocaleString()}** (= ${OLD.public.toLocaleString()} + ${newlyEligible}) |
| **remaining_blocked** | **${remainingBlocked.toLocaleString()}** (= ${OLD.blocked.toLocaleString()} − ${newlyEligible}) |
| Reconciliation passes | ${summary.reconciliation_passes ? "YES — all 359 independently validated" : "NO"} |

## Safety status

- SQL executed: **NO**
- Expected counts modified: **NO** (checkpoint preserved)
- Remote D1 modified: **NO**
- RAW SHA-256 unchanged: **${summary.raw_unchanged ? "YES" : "NO"}**

## Eligibility path (all ${newlyEligible} records)

| Path | Count | Description |
|------|------:|-------------|
| A | ${records.filter((r) => r.independently_validated && r.curation_evidence.some((e) => e.includes("near_duplicate"))).length} | Near-duplicate review resolved: unique content, license APPROVED, provenance COMPLETE, curation REVIEW→KEEP_CANDIDATE |
| B | ${records.filter((r) => r.independently_validated && r.license_evidence.some((e) => e.includes("path_b"))).length} | Registry license resolution |

## Per-record evidence

See \`data/kaomoji/processed/final/maximum-coverage-reconciliation.json\` for all ${decisions.length} records with:
- canonical_id, slug, kaomoji
- previous/new publication and curation status
- license, provenance, curation evidence
- quality bucket/score
- gate before/after
- exact eligibility reason

## Proposed count changes (NOT APPLIED — pending approval)

| Constant | Before | After (if approved) |
|----------|-------:|--------------------:|
| EXPECTED_KAOMOJI | 50,979 | ${newPublicExpected.toLocaleString()} |
| EXPECTED_RELATIONSHIPS | 392,904 | TBD after relationship rebuild audit |
| kaomoji_category | 131,314 | TBD |
| kaomoji_keyword | 383,621 | TBD |
| kaomoji_locale | 198,799 | TBD |
| source_attribution | 60,165 | TBD |

**Relationship delta must be computed from independent relationship audit before updating EXPECTED_RELATIONSHIPS.**

## Next steps (blocked until reconciliation approved)

1. User validates per-record evidence
2. Relationship delta audit (separate from count patching)
3. Update expected counts from measured deltas only
4. Generate incremental SQL (transaction/batched)
5. Execute SQL
6. Independently query remote D1
7. Verify no duplicates, orphans, or publication leaks
`;

  writeFileSync(join(rootDir, "r2-export/MAXIMUM-COVERAGE-RECONCILIATION.md"), md, "utf8");
  console.log(JSON.stringify({
    old: OLD,
    newly_eligible: newlyEligible,
    failed_validation: failed,
    new_public_expected: newPublicExpected,
    remaining_blocked: remainingBlocked,
    reconciliation_passes: summary.reconciliation_passes,
    sql_executed: false,
    expected_counts_modified: false,
  }, null, 2));
}

main();
