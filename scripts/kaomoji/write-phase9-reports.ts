import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase9Manifest } from "@/lib/kaomoji/processing/phase9/types";
import { getPhase9ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase9Manifest {
  const p = getPhase9ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase9 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase9Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.raw_removed === 0 && m.raw_before === m.raw_after && m.errors.length === 0
    ? (m.warnings.length ? "PASS WITH WARNINGS" : "PASS") : "FAIL";
  write("PHASE-9-KAOMOJI-DATABASE.md", `# Phase 9 Database\n\nCanonical: ${m.canonical_candidates}\nPublic: ${m.public_candidates}\nRAW: ${m.raw_after}\n`);
  write("PHASE-9-TAXONOMY.md", `# Phase 9 Taxonomy\n\nAssigned: ${m.categories_assigned}\nReview: ${m.categories_review}\n`);
  write("PHASE-9-KEYWORDS.md", `# Phase 9 Keywords\n\nTotal keyword entries: ${m.keywords_total}\n`);
  write("PHASE-9-NAMES.md", `# Phase 9 Names\n\nAssigned: ${m.names_assigned}\nReview: ${m.names_review}\n`);
  write("PHASE-9-MEANINGS.md", `# Phase 9 Meanings\n\nTier 1: ${m.tier_1}\nTier 2: ${m.tier_2}\nTier 3: ${m.tier_3}\nEditorial meanings: ${m.meanings_editorial}\n`);
  write("PHASE-9-QUALITY.md", `# Phase 9 Quality\n\nQuality version retained from Phase 8 + Phase 9 scoring version.\n`);
  write("PHASE-9-BEAUTY.md", `# Phase 9 Beauty\n\nEmojiQuick Aesthetic Score — deterministic, not popularity.\n`);
  write("PHASE-9-RELATIONSHIPS.md", `# Phase 9 Relationships\n\nTotal: ${m.relationships}\n`);
  write("PHASE-9-SEARCH.md", `# Phase 9 Search\n\nIndex records: ${m.search_index_records}\nQuality cases: ${m.search_quality_cases}\n`);
  write("PHASE-9-COLLECTIONS.md", `# Phase 9 Collections\n\nCollections: ${m.collections}\n`);
  write("PHASE-9-SEO.md", `# Phase 9 SEO\n\nIndexable pages: ${m.seo_indexable_pages}\n`);
  write("PHASE-9-ANALYTICS.md", `# Phase 9 Analytics\n\nEvents: ${m.analytics_events_supported.join(", ")}\nPopularity: ${m.popularity_status}\n`);
  write("PHASE-9-MULTILINGUAL.md", `# Phase 9 Multilingual\n\nFoundation only — English canonical URLs preserved.\n`);
  write("PHASE-9-ACCESSIBILITY.md", `# Phase 9 Accessibility\n\nAccessible names on all public kaomoji cards and detail pages.\n`);
  write("PHASE-9-PERFORMANCE.md", `# Phase 9 Performance\n\nServer-side search index; no 63k browser load.\n`);
  write("PHASE-9-TESTS.md", `# Phase 9 Tests\n\nRun: npx tsx --test src/lib/kaomoji/kaomoji-phase9.test.ts\n`);
  write("PHASE-9-DEPLOYMENT.md", `# Phase 9 Deployment\n\nDeploy only after tests + build pass. RAW must remain ${m.raw_after}.\n`);
  write("PHASE-9-FINAL.md", `# Phase 9 Final\n\n**Verdict: ${verdict}**\n\n| RAW | ${m.raw_after} |\n| Public | ${m.public_candidates} |\n| Tier 1/2/3 | ${m.tier_1} / ${m.tier_2} / ${m.tier_3} |\n| Collections | ${m.collections} |\n| Search index | ${m.search_index_records} |\n`);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-9-canonical.json"), JSON.stringify({ count: m.canonical_candidates, public: m.public_candidates }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-taxonomy.json"), JSON.stringify({ assigned: m.categories_assigned, review: m.categories_review }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-editorial.json"), JSON.stringify({ tier_1: m.tier_1, tier_2: m.tier_2, tier_3: m.tier_3 }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-search.json"), JSON.stringify({ records: m.search_index_records, cases: m.search_quality_cases }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-collections.json"), JSON.stringify({ count: m.collections }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-seo.json"), JSON.stringify({ indexable: m.seo_indexable_pages }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-final.json"), JSON.stringify(m, null, 2));
  console.log("Verdict:", verdict);
}
main();
