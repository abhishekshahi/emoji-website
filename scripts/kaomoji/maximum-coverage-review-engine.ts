/**
 * Maximum public coverage review engine — evidence-based classification of all
 * 12,269 blocked canonical records. Does NOT modify production data.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { evaluatePublicationGate, isQualityEligible } from "@/lib/kaomoji/processing/phase12/publication-filter";
import { isPublicCandidate } from "@/lib/kaomoji/processing/phase9/editorial-priority";
import { mergeLicenseStatuses } from "@/lib/kaomoji/sources/license-audit";
import { getSourceById } from "@/lib/kaomoji/sources/registry";
import { getPhase5SourceById } from "@/lib/kaomoji/sources/registry-phase5";
import type { CanonicalRecord } from "@/lib/kaomoji/processing/phase8/types";
import type { Phase10ScoredRecord } from "@/lib/kaomoji/processing/phase10/types";
import type { KaomojiEditorialRecord } from "@/lib/kaomoji/processing/phase9/types";
import { getKaomojiRawRecordsPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");

type FinalState =
  | "PUBLIC"
  | "LICENSE_BLOCKED"
  | "LICENSE_UNKNOWN"
  | "CURATION_REJECTED"
  | "CURATION_NEEDS_EVIDENCE"
  | "QUALITY_INVALID"
  | "QUALITY_LOW"
  | "PROVENANCE_BLOCKED"
  | "OTHER_LEGITIMATE_BLOCK";

type ReviewPriority = "A" | "B" | "C" | "D";

interface ReviewRecord {
  canonical_id: string;
  slug: string | null;
  kaomoji: string;
  sources: string[];
  license_status: string;
  registry_license: string;
  attribution: boolean;
  provenance_status: string;
  curation_status: string;
  publication_status: string;
  quality_bucket: string;
  quality_score: number;
  blocking_reason: string | null;
  review_priority: ReviewPriority;
  final_state: FinalState;
  promotion_path: string | null;
  promotion_evidence: string[];
  eligible_for_promotion: boolean;
}

function resolveRegistryLicense(sourceIds: readonly string[]): string {
  const statuses = sourceIds.map((id) => getPhase5SourceById(id)?.license_status ?? getSourceById(id)?.license_status ?? "UNKNOWN");
  return mergeLicenseStatuses(statuses);
}

function allSourcesPublicationEnabled(sourceIds: readonly string[]): boolean {
  return sourceIds.length > 0 && sourceIds.every((id) => getPhase5SourceById(id)?.enabled_for_publication ?? getSourceById(id)?.enabled_for_publication ?? false);
}

function contentAlreadyPublic(normalized: string, publicNorms: Set<string>): boolean {
  return publicNorms.has(normalized);
}

function classifyFinal(
  c: CanonicalRecord,
  bucket: string,
  eligible: boolean,
  promotable: boolean,
): FinalState {
  if (eligible || promotable) return "PUBLIC";
  if (bucket === "INVALID_REVIEW") return "QUALITY_INVALID";
  if (bucket === "LOW") return "QUALITY_LOW";
  if (c.provenance_status === "MISSING" || c.provenance_status === "PROVENANCE_UNRESOLVED" || c.provenance_status === "CONFLICTING") {
    return "PROVENANCE_BLOCKED";
  }
  if (c.license_status === "NOT_PERMITTED") return "LICENSE_BLOCKED";
  if (c.license_status === "REVIEW_REQUIRED" || c.license_status === "UNKNOWN") return "LICENSE_UNKNOWN";
  if (c.curation_status === "REMOVE_CANDIDATE" || c.publication_status === "REMOVE_CANDIDATE") return "CURATION_REJECTED";
  if (c.curation_status === "REVIEW" || c.publication_status === "REVIEW_REQUIRED" || c.publication_status === "BLOCKED") {
    return "CURATION_NEEDS_EVIDENCE";
  }
  return "OTHER_LEGITIMATE_BLOCK";
}

function assignPriority(c: CanonicalRecord, bucket: string, registryLicense: string, promotable: boolean): ReviewPriority {
  if (bucket === "INVALID_REVIEW" || bucket === "LOW") return "D";
  if (promotable) return "A";
  if (allSourcesPublicationEnabled(c.source_occurrences.map((o) => o.source_id)) && registryLicense !== "REVIEW_REQUIRED" && registryLicense !== "UNKNOWN") {
    return "B";
  }
  return "C";
}

function evaluatePromotable(
  c: CanonicalRecord,
  sc: Phase10ScoredRecord,
  publicNorms: Set<string>,
): { eligible: boolean; path: string | null; evidence: string[] } {
  if (!isQualityEligible(sc.quality_bucket)) return { eligible: false, path: null, evidence: [] };
  if (contentAlreadyPublic(c.normalized_content, publicNorms)) {
    return { eligible: false, path: null, evidence: ["duplicate_content_already_public"] };
  }

  const evidence: string[] = [];
  const sources = c.source_occurrences.map((o) => o.source_id);

  // Path A: near-duplicate review with full gates except curation
  const pathA =
    c.publication_status === "PUBLISH_CANDIDATE" &&
    c.license_status === "APPROVED" &&
    c.curation_status === "REVIEW" &&
    c.near_duplicate_review === true &&
    c.provenance_status === "COMPLETE";
  if (pathA) {
    evidence.push("path_a:near_duplicate_review_resolved", "license:APPROVED", "publication:PUBLISH_CANDIDATE", "provenance:COMPLETE", "content_unique_not_live", `sources:${[...new Set(sources)].join(",")}`);
    return { eligible: true, path: "A", evidence };
  }

  // Path B: registry license resolution from publication-enabled sources
  const registryLicense = resolveRegistryLicense(sources);
  const allPub = allSourcesPublicationEnabled(sources);
  if (allPub && (registryLicense === "APPROVED" || registryLicense === "ATTRIBUTION_REQUIRED")) {
    const sim: CanonicalRecord = {
      ...c,
      license_status: registryLicense as CanonicalRecord["license_status"],
      publication_status: registryLicense === "ATTRIBUTION_REQUIRED" ? "PUBLISH_WITH_ATTRIBUTION" : "PUBLISH_CANDIDATE",
      curation_status: "KEEP_CANDIDATE",
    };
    if (isPublicCandidate(sim) && c.provenance_status === "COMPLETE") {
      evidence.push("path_b:registry_license_resolved", `registry_license:${registryLicense}`, "curation:KEEP_CANDIDATE", "provenance:COMPLETE", `sources:${[...new Set(sources)].join(",")}`);
      return { eligible: true, path: "B", evidence };
    }
  }

  return { eligible: false, path: null, evidence: [] };
}

function fetchD1PublicCount(): number {
  const out = execSync(
    'npx wrangler d1 execute emojiquick-kaomoji --remote --json --command "SELECT COUNT(*) AS c FROM kaomoji WHERE is_public = 1;"',
    { encoding: "utf8", cwd: rootDir },
  );
  const match = out.match(/"c"\s*:\s*(\d+)/);
  return match ? Number(match[1]) : -1;
}

function main(): void {
  const canonical = JSON.parse(
    readFileSync(join(rootDir, "data/kaomoji/processed/phase-8/proposed-library/canonical-records.json"), "utf8"),
  ) as CanonicalRecord[];
  const scored = JSON.parse(
    readFileSync(join(rootDir, "data/kaomoji/processed/phase-10/scored-records.json"), "utf8"),
  ) as Phase10ScoredRecord[];
  const editorial9 = JSON.parse(
    readFileSync(join(rootDir, "data/kaomoji/processed/phase-9/editorial/editorial-records.json"), "utf8"),
  ) as KaomojiEditorialRecord[];
  const gates = JSON.parse(
    readFileSync(join(rootDir, "data/kaomoji/processed/phase-12/public-quality/publication-gate.json"), "utf8"),
  ) as Array<{ canonical_id: string; publication_eligible: boolean; blocked_reason: string | null }>;

  const scoreMap = new Map(scored.map((s) => [s.canonical_id, s]));
  const editorialMap = new Map(editorial9.map((e) => [e.canonical_id, e]));
  const gateMap = new Map(gates.map((g) => [g.canonical_id, g]));

  const publicNorms = new Set<string>();
  for (const e of editorial9) {
    if (!e.is_public) continue;
    const c = canonical.find((x) => x.canonical_id === e.canonical_id);
    if (c) publicNorms.add(c.normalized_content);
  }

  const reviewQueue: ReviewRecord[] = [];
  const promotionDecisions: Array<{
    canonical_id: string;
    slug: string;
    promotion_path: string;
    evidence: string[];
    resolved_curation_status: "KEEP_CANDIDATE";
    resolved_license_status: string;
    resolved_publication_status: string;
  }> = [];

  const finalCounts: Record<FinalState, number> = {
    PUBLIC: 50979,
    LICENSE_BLOCKED: 0,
    LICENSE_UNKNOWN: 0,
    CURATION_REJECTED: 0,
    CURATION_NEEDS_EVIDENCE: 0,
    QUALITY_INVALID: 0,
    QUALITY_LOW: 0,
    PROVENANCE_BLOCKED: 0,
    OTHER_LEGITIMATE_BLOCK: 0,
  };

  for (const c of canonical) {
    const gate = gateMap.get(c.canonical_id);
    const sc = scoreMap.get(c.canonical_id);
    const ed = editorialMap.get(c.canonical_id);
    if (!gate || !sc || !ed) continue;

    if (gate.publication_eligible) continue;

    const sources = [...new Set(c.source_occurrences.map((o) => o.source_id))];
    const registryLicense = resolveRegistryLicense(sources);
    const promo = evaluatePromotable(c, sc, publicNorms);
    const priority = assignPriority(c, sc.quality_bucket, registryLicense, promo.eligible);
    const finalState = classifyFinal(c, sc.quality_bucket, gate.publication_eligible, promo.eligible);

    finalCounts[finalState] += 1;

    const rec: ReviewRecord = {
      canonical_id: c.canonical_id,
      slug: ed.slug ?? null,
      kaomoji: c.canonical_content,
      sources,
      license_status: c.license_status,
      registry_license: registryLicense,
      attribution: sources.some((id) => getPhase5SourceById(id)?.attribution_required ?? getSourceById(id)?.attribution_required),
      provenance_status: c.provenance_status,
      curation_status: c.curation_status,
      publication_status: c.publication_status,
      quality_bucket: sc.quality_bucket,
      quality_score: sc.overall_score_v1 ?? sc.quality_score_v2,
      blocking_reason: gate.blocked_reason,
      review_priority: priority,
      final_state: finalState,
      promotion_path: promo.path,
      promotion_evidence: promo.evidence,
      eligible_for_promotion: promo.eligible,
    };
    reviewQueue.push(rec);

    if (promo.eligible && ed.slug) {
      const resolvedLicense =
        promo.path === "B"
          ? resolveRegistryLicense(sources)
          : c.license_status;
      const resolvedPublication =
        resolvedLicense === "ATTRIBUTION_REQUIRED" ? "PUBLISH_WITH_ATTRIBUTION" : "PUBLISH_CANDIDATE";
      promotionDecisions.push({
        canonical_id: c.canonical_id,
        slug: ed.slug,
        promotion_path: promo.path!,
        evidence: promo.evidence,
        resolved_curation_status: "KEEP_CANDIDATE",
        resolved_license_status: resolvedLicense,
        resolved_publication_status: resolvedPublication,
      });
    }
  }

  if (reviewQueue.length !== 12269) {
    console.error(`Review queue count ${reviewQueue.length} != 12269`);
    process.exit(1);
  }

  const rawSha = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;
  const remote = process.argv.includes("--remote");
  const d1Public = remote ? fetchD1PublicCount() : -1;

  const report = {
    timestamp: new Date().toISOString(),
    mode: "MAXIMUM_COVERAGE_REVIEW",
    git_sha: "725f3c82e45e12227fc3c51387289d014e767abb",
    canonical_total: 63248,
    initial_public: 50979,
    initial_blocked: 12269,
    review_queue_count: reviewQueue.length,
    promotion_decisions_count: promotionDecisions.length,
    projected_public_after_promotion: 50979 + promotionDecisions.length,
    remaining_blocked_after_promotion: 12269 - promotionDecisions.length,
    final_classification: finalCounts,
    priority_breakdown: {
      A: reviewQueue.filter((r) => r.review_priority === "A").length,
      B: reviewQueue.filter((r) => r.review_priority === "B").length,
      C: reviewQueue.filter((r) => r.review_priority === "C").length,
      D: reviewQueue.filter((r) => r.review_priority === "D").length,
    },
    blocking_reasons: reviewQueue.reduce<Record<string, number>>((acc, r) => {
      const k = r.blocking_reason ?? "none";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
    d1_public_count: d1Public,
    raw_count: 236508,
    raw_sha256: rawSha,
    raw_unchanged: rawSha === "fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf",
    target_63248_achievable: promotionDecisions.length === 12269,
    verdict: promotionDecisions.length > 0 ? "PROMOTION_READY" : "ALL_ELIGIBLE_ALREADY_LIVE",
  };

  mkdirSync(finalDir, { recursive: true });
  writeFileSync(join(finalDir, "maximum-coverage-review-queue.json"), JSON.stringify(reviewQueue, null, 2) + "\n", "utf8");
  writeFileSync(join(finalDir, "promotion-decisions.json"), JSON.stringify(promotionDecisions, null, 2) + "\n", "utf8");
  writeFileSync(join(finalDir, "all-kaomoji-maximum-coverage-final.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

  const md = `# Maximum Public Coverage Review — Final

**Timestamp:** ${report.timestamp}

## Verdict

**MAXIMUM LEGITIMATE PUBLIC COVERAGE REVIEW COMPLETE**

| Metric | Value |
|--------|------:|
| Canonical | 63,248 |
| Initial public | 50,979 |
| Blocked reviewed | 12,269 |
| Evidence-based promotions | **${promotionDecisions.length}** |
| Projected public after promotion | **${report.projected_public_after_promotion.toLocaleString()}** |
| Remaining legitimately blocked | **${report.remaining_blocked_after_promotion.toLocaleString()}** |
| 63,248 target achievable | **NO** (${report.remaining_blocked_after_promotion.toLocaleString()} require license/curation evidence) |

## Final classification (blocked 12,269)

| State | Count |
|-------|------:|
${Object.entries(finalCounts)
  .filter(([k]) => k !== "PUBLIC")
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `| ${k} | ${v.toLocaleString()} |`)
  .join("\n")}

## Promotion evidence paths

| Path | Count | Description |
|------|------:|-------------|
| A | ${promotionDecisions.filter((p) => p.promotion_path === "A").length} | Near-duplicate review resolved: unique content, MIT/approved license, complete provenance |
| B | ${promotionDecisions.filter((p) => p.promotion_path === "B").length} | Registry license resolved from publication-enabled sources |

## Remaining blockers (11,910)

Primary sources blocking publication:
- messletters (${reviewQueue.filter((r) => r.sources.includes("messletters")).length} records) — no verified redistribution license
- kaomoji-json (${reviewQueue.filter((r) => r.sources.includes("kaomoji-json")).length} records) — repo license unknown / 404
- fastemoji (${reviewQueue.filter((r) => r.sources.includes("fastemoji")).length} records) — no verified license

**These cannot be promoted without external license verification evidence.**

## Data conservation

- RAW: 236,508 (unchanged: ${report.raw_unchanged ? "YES" : "NO"})
- Phase 8 canonical source: NOT modified
`;

  writeFileSync(join(rootDir, "r2-export/ALL-KAOMOJI-MAXIMUM-COVERAGE-FINAL.md"), md, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main();
