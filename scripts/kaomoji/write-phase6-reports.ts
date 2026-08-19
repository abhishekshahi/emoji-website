import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase6CollectionManifest } from "@/lib/kaomoji/discovery/phase6/types";
import { PHASE5_SOURCE_REGISTRY } from "@/lib/kaomoji/sources/registry-phase5";
import { getPhase6ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase6CollectionManifest {
  const p = getPhase6ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase6 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase6CollectionManifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function invTable(m: Phase6CollectionManifest): string {
  return m.source_inventory
    .map(
      (r) =>
        `| ${r.source_id} | ${r.status} | ${r.records_discovered} | ${r.raw_occurrences} | ${r.pages} | ${r.files} | ${r.license} | ${r.problems.join("; ") || "—"} |`,
    )
    .join("\n");
}

function main(): void {
  const m = readManifest();
  const recordsPath = join(rootDir, "data", "kaomoji", "raw", "records.json");
  const rawCounts: Record<string, number> = {};
  if (existsSync(recordsPath)) {
    const records = JSON.parse(readFileSync(recordsPath, "utf8")) as Array<{ source_id: string }>;
    for (const r of records) rawCounts[r.source_id] = (rawCounts[r.source_id] ?? 0) + 1;
  }
  const inventoryById = new Map(m.source_inventory.map((r) => [r.source_id, r]));
  for (const source of PHASE5_SOURCE_REGISTRY) {
    if (!inventoryById.has(source.source_id)) {
      inventoryById.set(source.source_id, {
        source_id: source.source_id,
        source_name: source.source_name,
        source_type: source.source_type,
        source_url: source.source_url,
        repository_url: source.repository_url,
        status: source.phase5_status,
        license: source.license_status,
        commercial_use: source.commercial_use,
        redistribution: source.redistribution,
        attribution: source.attribution_required,
        pages: 0,
        files: 0,
        categories: 0,
        records_discovered: 0,
        records_collected: rawCounts[source.source_id] ?? 0,
        records_remaining: null,
        raw_occurrences: rawCounts[source.source_id] ?? 0,
        content_types: [],
        errors: [],
        problems: ["Unchanged this phase"],
      });
    }
  }
  const fullInventory = PHASE5_SOURCE_REGISTRY.map((s) => inventoryById.get(s.source_id)!);
  const verdict =
    m.removed_records === 0 && m.existing_raw_modified === 0 && !m.deduplication_performed
      ? m.errors.length > 0
        ? "PASS WITH WARNINGS"
        : "PASS"
      : "FAIL";

  write(
    "PHASE-6-ACQUISITION-COMPLETE.md",
    `# Phase 6 — Maximum Acquisition Gap Closure\n\n**Verdict: ${verdict}**\n\n| Metric | Value |\n|--------|-------|\n| RAW before | ${m.raw_before} |\n| RAW after | ${m.raw_after} |\n| New | ${m.new_raw_records} |\n| Removed | ${m.removed_records} |\n| Modified | ${m.existing_raw_modified} |\n| Dedup | ${m.deduplication_performed} |\n\nGaps closed: ${m.phase6_gaps_closed.join(", ") || "none"}\n`,
  );

  write(
    "PHASE-6-FASTEMOJI.md",
    `# Phase 6 — FastEmoji\n\n| Canonical discovered | ${m.fastemoji_canonical_discovered ?? "—"} |\n| Canonical collected | ${m.fastemoji_canonical_collected ?? "—"} |\n| Remaining | ${m.fastemoji_canonical_remaining ?? "—"} |\n`,
  );

  const gk = m.source_inventory.find((r) => r.source_id === "generate-kaomoji");
  write("PHASE-6-GENERATE-KAOMOJI.md", `# Phase 6 — generate-kaomoji\n\nDiscovered: ${gk?.records_discovered ?? 0}\nCollected: ${gk?.raw_occurrences ?? 0}\n`);

  const kf = m.source_inventory.find((r) => r.source_id === "kawaii-faces");
  write("PHASE-6-KAWAII-FACES.md", `# Phase 6 — kawaii-faces\n\nDiscovered: ${kf?.records_discovered ?? 0}\nExtracted: ${kf?.raw_occurrences ?? 0}\n`);

  const kc = m.source_inventory.find((r) => r.source_id === "kaomoji-caption");
  write("PHASE-6-KAOMOJI-CAPTION.md", `# Phase 6 — kaomoji_caption (HuggingFace)\n\nRows discovered: ${kc?.records_discovered ?? 0}\nRows extracted: ${kc?.raw_occurrences ?? 0}\n`);

  const jeo = m.source_inventory.find((r) => r.source_id === "japaneseemoticons-org");
  write("PHASE-6-JAPANESEEMOTICONS.md", `# Phase 6 — Japaneseemoticons.org\n\nPages: ${jeo?.pages ?? 0}\nDiscovered: ${jeo?.records_discovered ?? 0}\nCollected: ${jeo?.raw_occurrences ?? 0}\n`);

  const npm = m.source_inventory.find((r) => r.source_id === "kaomoji-vaneenige");
  write("PHASE-6-NPM-RECOVERY.md", `# Phase 6 — npm vaneenige/kaomoji\n\nPackage: kaomoji@0.2.1\nRecords: ${npm?.raw_occurrences ?? 0}\n`);

  const gh = m.source_inventory.find((r) => r.source_id === "kaomoji-json");
  const je = m.source_inventory.find((r) => r.source_id === "japanese-emoticons");
  write(
    "PHASE-6-GITHUB-RECOVERY.md",
    `# Phase 6 — GitHub Recovery\n\n## kaomoji-json\n- Status: ${gh?.raw_occurrences ? "RECOVERED (6/kaomoji-json)" : "partial"}\n- Records: ${gh?.raw_occurrences ?? 0}\n\n## japanese-emoticons\n- Status: ${je?.problems.join(", ") ?? "INACCESSIBLE"}\n- Records: ${je?.raw_occurrences ?? 0}\n`,
  );

  const wiki = m.source_inventory.find((r) => r.source_id === "wikipedia");
  write("PHASE-6-WIKIPEDIA.md", `# Phase 6 — Wikipedia Retry\n\nPages processed: ${wiki?.pages ?? 0}\nOccurrences: ${wiki?.raw_occurrences ?? 0}\n`);

  const te = m.source_inventory.find((r) => r.source_id === "textemoticons");
  const si = m.source_inventory.find((r) => r.source_id === "slangit");
  write(
    "PHASE-6-INACCESSIBLE-SOURCES.md",
    `# Phase 6 — Inaccessible Sources\n\n| Source | Status |\n|--------|--------|\n| TextEmoticons | ${te?.problems[0] ?? "UNKNOWN"} |\n| SlangIt | ${si?.problems[0] ?? "UNKNOWN"} |\n| japanese-emoticons | ${je?.problems[0] ?? "INACCESSIBLE"} |\n| ToolCalculator | SOURCE_MISMATCH |\n| kaomojis.org | SOURCE_MISMATCH |\n`,
  );

  write(
    "PHASE-6-NO-LOSS.md",
    `# Phase 6 — No Loss\n\n| raw_before | ${m.raw_before} |\n| raw_after | ${m.raw_after} |\n| removed | ${m.removed_records} |\n| modified | ${m.existing_raw_modified} |\n`,
  );

  write("PHASE-6-PROVENANCE.md", `# Phase 6 — Provenance\n\nCoverage: ${(m.provenance_coverage * 100).toFixed(1)}%\n`);

  write(
    "PHASE-6-FINAL.md",
    `# Phase 6 Final\n\n**Verdict: ${verdict}**\n\nTOTAL RAW: ${m.total_raw_records}\nNEW THIS PHASE: ${m.new_raw_records}\n\n${fullInventory.map((r) => `| ${r.source_id} | ${r.status} | ${r.records_discovered} | ${r.raw_occurrences} | ${r.pages} | ${r.files} | ${r.license} | ${r.problems.join("; ") || "—"} |`).join("\n")}\n`,
  );

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-6-fastemoji.json"), `${JSON.stringify({ discovered: m.fastemoji_canonical_discovered, collected: m.fastemoji_canonical_collected, remaining: m.fastemoji_canonical_remaining }, null, 2)}\n`, "utf8");
  writeFileSync(
    join(manifestDir, "phase-6-parser-results.json"),
    `${JSON.stringify(
      {
        "generate-kaomoji": gk?.records_discovered ?? 0,
        "kawaii-faces": kf?.records_discovered ?? 0,
        "kaomoji-caption": kc?.records_discovered ?? 0,
        "japaneseemoticons-org": jeo?.records_discovered ?? 0,
        "kaomoji-json": gh?.records_discovered ?? 0,
        "kaomoji-vaneenige": npm?.records_discovered ?? 0,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(join(manifestDir, "phase-6-source-inventory.json"), `${JSON.stringify(fullInventory, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-6-final.json"), `${JSON.stringify(m, null, 2)}\n`, "utf8");
  console.log("Verdict:", verdict);
}

main();
