/**
 * Apply evidence-based maximum-coverage promotions through the authoritative pipeline.
 * Does NOT modify phase-8 canonical source or RAW.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { runPhase12Pipeline } from "@/lib/kaomoji/processing/phase12/pipeline";
import { runPhase14Pipeline } from "@/lib/kaomoji/processing/phase14/pipeline";
import type { CurationResolution } from "@/lib/kaomoji/processing/phase12/types";
import { getCurationResolutionsPath, getKaomojiRawRecordsPath, getPhase12PublicQualityDir } from "@/lib/kaomoji/storage/paths";
import { buildIncrementalD1Export } from "./maximum-coverage-d1-incremental";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const PREVIOUS_PUBLIC = 50979;
const PREVIOUS_RELATIONSHIPS = 392904;

interface PromotionDecision {
  canonical_id: string;
  slug: string;
  promotion_path: string;
  evidence: string[];
  resolved_curation_status: "KEEP_CANDIDATE";
  resolved_license_status: string;
  resolved_publication_status: string;
}

function main(): void {
  const remote = process.argv.includes("--remote");
  const dryRun = process.argv.includes("--dry-run");

  const decisions = JSON.parse(
    readFileSync(join(finalDir, "promotion-decisions.json"), "utf8"),
  ) as PromotionDecision[];

  if (decisions.length !== 359) {
    console.error(`Expected 359 promotion decisions, got ${decisions.length}`);
    process.exit(1);
  }

  const resolutions: CurationResolution[] = decisions.map((d) => ({
    canonical_id: d.canonical_id,
    slug: d.slug,
    promotion_path: d.promotion_path,
    evidence: d.evidence,
    resolved_curation_status: d.resolved_curation_status,
    resolved_license_status: d.resolved_license_status,
    resolved_publication_status: d.resolved_publication_status,
  }));

  mkdirSync(finalDir, { recursive: true });
  const resolutionsPath = getCurationResolutionsPath(rootDir);
  writeFileSync(resolutionsPath, JSON.stringify(resolutions, null, 2) + "\n", "utf8");
  console.log("Wrote curation resolutions:", resolutions.length);

  const libDir = getPhase12PublicQualityDir(rootDir);
  const backupDir = join(finalDir, "pre-promotion-backup");
  mkdirSync(backupDir, { recursive: true });
  for (const file of ["editorial.json", "relationships.json", "manifest.json"]) {
    const src = join(libDir, file);
    if (existsSync(src)) copyFileSync(src, join(backupDir, file));
  }

  const rawShaBefore = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;
  const p12 = runPhase12Pipeline(rootDir);
  console.log("Phase 12 publication eligible:", p12.manifest.publication_eligible);

  if (p12.manifest.publication_eligible !== PREVIOUS_PUBLIC + decisions.length) {
    console.error(
      `Publication eligible ${p12.manifest.publication_eligible} != expected ${PREVIOUS_PUBLIC + decisions.length}`,
    );
    process.exit(1);
  }

  const p14 = runPhase14Pipeline(rootDir);
  console.log(
    "Phase 14 benchmark:",
    p14.manifest.benchmark_pass_count + "/" + p14.manifest.benchmark_queries,
  );

  const newRelationships = JSON.parse(
    readFileSync(join(libDir, "relationships.json"), "utf8"),
  ).length;
  const newPublic = p12.manifest.publication_eligible;
  const deltaRelationships = newRelationships - PREVIOUS_RELATIONSHIPS;

  console.log("New public:", newPublic);
  console.log("New relationships:", newRelationships, `(+${deltaRelationships})`);

  updateExpectedConstants(newPublic, newRelationships);

  if (dryRun) {
    console.log("Dry run — skipping phase19 export and D1 import");
    process.exit(0);
  }

  execSync("npx tsx scripts/kaomoji/run-phase19.ts", { cwd: rootDir, stdio: "inherit" });

  const incremental = buildIncrementalD1Export(rootDir, {
    previousPublicIds: loadPreviousPublicIds(backupDir),
    promotedIds: new Set(decisions.map((d) => d.canonical_id)),
  });
  console.log("Incremental D1 rows:", incremental.summary);

  if (remote) {
    execSync(`npx tsx scripts/kaomoji/maximum-coverage-d1-incremental.ts --remote`, {
      cwd: rootDir,
      stdio: "inherit",
    });
  }

  const rawShaAfter = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;
  const report = {
    timestamp: new Date().toISOString(),
    mode: "MAXIMUM_COVERAGE_PROMOTION",
    initial_public: PREVIOUS_PUBLIC,
    initial_blocked: 12269,
    promoted: decisions.length,
    final_public: newPublic,
    remaining_blocked: 63248 - newPublic,
    initial_relationships: PREVIOUS_RELATIONSHIPS,
    final_relationships: newRelationships,
    delta_relationships: deltaRelationships,
    phase14_benchmark: `${p14.manifest.benchmark_pass_count}/${p14.manifest.benchmark_queries}`,
    raw_sha256: rawShaAfter,
    raw_unchanged: rawShaBefore === rawShaAfter && rawShaAfter === "fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf",
    incremental_d1: incremental.summary,
    verdict: "PROMOTION_APPLIED",
  };

  writeFileSync(
    join(finalDir, "all-kaomoji-maximum-coverage-final.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
}

function loadPreviousPublicIds(backupDir: string): Set<string> {
  const editorial = JSON.parse(
    readFileSync(join(backupDir, "editorial.json"), "utf8"),
  ) as Array<{ canonical_id: string }>;
  return new Set(editorial.map((r) => r.canonical_id));
}

function updateExpectedConstants(publicCount: number, relationshipCount: number): void {
  const file = join(rootDir, "src/lib/kaomoji/cloudflare/d1-import.ts");
  let content = readFileSync(file, "utf8");
  content = content.replace(/export const EXPECTED_KAOMOJI = \d+ as const;/, `export const EXPECTED_KAOMOJI = ${publicCount} as const;`);
  content = content.replace(/export const EXPECTED_RELATIONSHIPS = \d+ as const;/, `export const EXPECTED_RELATIONSHIPS = ${relationshipCount} as const;`);
  writeFileSync(file, content, "utf8");
  console.log("Updated EXPECTED constants:", publicCount, relationshipCount);
}

main();
