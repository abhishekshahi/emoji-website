const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const file = path.join(root, "src/lib/kaomoji/processing/phase11/composition-audit.ts");
let s = fs.readFileSync(file, "utf8");

s = s.replace(
  `function confidenceFor(ed: KaomojiEditorialRecord): ClassificationConfidence {
  if (ed.category_status === "ASSIGNED") return "CONFIRMED";
  if (ed.emojiquick_categories.length === 0) return "REVIEW";
  return "REVIEW";
}`,
  `function confidenceFor(ed: KaomojiEditorialRecord): ClassificationConfidence {
  if (ed.category_status === "ASSIGNED") return "CONFIRMED";
  if (ed.emojiquick_categories.length === 0) return "REVIEW";
  return "INFERRED";
}`,
);

s = s.replace(
  `  const variantComposition: Record<string, number> = {
    total_groups: input.variantGroups.length,
    legitimate_variants: input.variantGroups.filter((v) => v.variant_type !== "category_context").length,
    review_variants: input.variantGroups.length,
    duplicate_like_variants: 0,
  };
  const variantCanonicalCounts: Record<string, number> = {
    EYE_VARIANT: 0, MOUTH_VARIANT: 0, HAND_VARIANT: 0, DECORATIVE_VARIANT: 0, STYLE_VARIANT: 0,
    EMOTION_VARIANT: 0, INTENSITY_VARIANT: 0, SPACING_VARIANT: 0, UNICODE_VARIANT: 0, OTHER: 0,
  };
  const canonicalInVariant = new Set<string>();
  for (const vg of input.variantGroups) {
    for (const rid of vg.raw_ids) {
      const cid = rawToCanonical.get(rid);
      if (cid) canonicalInVariant.add(cid);
    }
    const vt = vg.variant_type ?? "other";
    if (vt.includes("formatting") || vt.includes("spacing")) variantCanonicalCounts.SPACING_VARIANT += vg.raw_ids.length;
    else if (vt.includes("unicode")) variantCanonicalCounts.UNICODE_VARIANT += vg.raw_ids.length;
    else if (vt.includes("category")) variantCanonicalCounts.EMOTION_VARIANT += vg.raw_ids.length;
    else variantCanonicalCounts.OTHER += vg.raw_ids.length;
  }`,
  `  const legitimateVariantGroups = input.variantGroups.filter((v) => v.variant_type !== "category_context");
  const reviewVariantGroups = input.variantGroups.filter((v) => v.variant_type === "category_context");
  const variantComposition: Record<string, number> = {
    total_groups: input.variantGroups.length,
    legitimate_variants: legitimateVariantGroups.length,
    review_variants: reviewVariantGroups.length,
    duplicate_like_variants: input.canonical.filter((c) => c.near_duplicate_review).length,
  };
  const variantCanonicalCounts: Record<string, number> = {
    EYE_VARIANT: 0, MOUTH_VARIANT: 0, HAND_VARIANT: 0, DECORATIVE_VARIANT: 0, STYLE_VARIANT: 0,
    EMOTION_VARIANT: 0, INTENSITY_VARIANT: 0, SPACING_VARIANT: 0, UNICODE_VARIANT: 0, OTHER: 0,
  };
  const variantCanonicalSets: Record<string, Set<string>> = Object.fromEntries(
    Object.keys(variantCanonicalCounts).map((k) => [k, new Set<string>()]),
  );
  for (const vg of input.variantGroups) {
    const vt = vg.variant_type ?? "other";
    let bucket = "OTHER";
    if (vt.includes("formatting") || vt.includes("spacing")) bucket = "SPACING_VARIANT";
    else if (vt.includes("unicode")) bucket = "UNICODE_VARIANT";
    else if (vt.includes("category")) bucket = "EMOTION_VARIANT";
    for (const rid of vg.raw_ids) {
      const cid = rawToCanonical.get(rid);
      if (cid) variantCanonicalSets[bucket].add(cid);
    }
  }
  for (const [k, set] of Object.entries(variantCanonicalSets)) variantCanonicalCounts[k] = set.size;`,
);

s = s.replace(
  `  const uniqueRecords = input.canonical.filter((c) => c.created_from_raw_ids.length === 1);
  const uniqueComposition: Record<string, number> = {
    total: uniqueRecords.length,
    unique_legitimate: uniqueRecords.filter((c) => c.curation_status === "KEEP_CANDIDATE").length,
    unique_review: uniqueRecords.filter((c) => c.curation_status === "REVIEW").length,
    unique_remove_candidate: uniqueRecords.filter((c) => c.curation_status === "REMOVE_CANDIDATE").length,
  };`,
  `  const uniqueRecords = input.canonical.filter((c) => c.created_from_raw_ids.length === 1);
  const uniqueByContentType: Record<string, number> = {};
  const uniqueByLicense: Record<string, number> = {};
  const uniqueByQuality: Record<string, number> = {};
  const uniqueByProvenance: Record<string, number> = {};
  for (const c of uniqueRecords) {
    uniqueByContentType[c.content_type] = (uniqueByContentType[c.content_type] ?? 0) + 1;
    uniqueByLicense[c.license_status] = (uniqueByLicense[c.license_status] ?? 0) + 1;
    uniqueByProvenance[c.provenance_status] = (uniqueByProvenance[c.provenance_status] ?? 0) + 1;
    const sc = scoredById.get(c.canonical_id);
    if (sc) uniqueByQuality[sc.quality_bucket] = (uniqueByQuality[sc.quality_bucket] ?? 0) + 1;
  }
  const uniqueComposition: Record<string, number | Record<string, number>> = {
    total: uniqueRecords.length,
    unique_legitimate: uniqueRecords.filter((c) => c.curation_status === "KEEP_CANDIDATE").length,
    unique_review: uniqueRecords.filter((c) => c.curation_status === "REVIEW").length,
    unique_remove_candidate: uniqueRecords.filter((c) => c.curation_status === "REMOVE_CANDIDATE").length,
    by_content_type: uniqueByContentType,
    by_license: uniqueByLicense,
    by_quality: uniqueByQuality,
    by_provenance: uniqueByProvenance,
  };`,
);

if (!s.includes("emotion_confidence")) {
  s = s.replace(
    `  const emotion = countByPrimarySlug(input.editorial, EMOTION_SLUGS, "EMOTION");`,
    `  const emotion = countByPrimarySlug(input.editorial, EMOTION_SLUGS, "EMOTION");
  const emotionConfidence = { CONFIRMED: 0, INFERRED: 0, REVIEW: 0 };
  for (const ed of input.editorial) {
    const hasEmotion = ed.emojiquick_categories.some((c) => c.group === "EMOTION");
    if (!hasEmotion) emotionConfidence.REVIEW += 1;
    else emotionConfidence[confidenceFor(ed)] += 1;
  }`,
  );
}

if (!s.includes("emotion_confidence:")) {
  s = s.replace(
    `    emotion,`,
    `    emotion,
    emotion_confidence: emotionConfidence,`,
  );
}

if (!s.includes("emotion_confidence")) {
  throw new Error("patch failed");
}

fs.writeFileSync(file, s, "utf8");
console.log("patched composition-audit.ts");

const typesFile = path.join(root, "src/lib/kaomoji/processing/phase11/types.ts");
let t = fs.readFileSync(typesFile, "utf8");
if (!t.includes("emotion_confidence")) {
  t = t.replace(
    `  readonly emotion: Record<string, number>;`,
    `  readonly emotion: Record<string, number>;
  readonly emotion_confidence: Record<string, number>;`,
  );
  fs.writeFileSync(typesFile, t, "utf8");
  console.log("patched types.ts");
}

const pipelineFile = path.join(root, "src/lib/kaomoji/processing/phase11/pipeline.ts");
let p = fs.readFileSync(pipelineFile, "utf8");
if (!p.includes("getPhase7RawSnapshotPath")) {
  p = p.replace(
    `import {
  getKaomojiRawRecordsPath,
  getPhase8ProposedLibraryDir,
  getPhase9EditorialDir,
  getPhase10RootDir,
  getPhase11ManifestPath,
  getPhase11RootDir,
  PHASE11_PIPELINE_VERSION,
} from "../../storage/paths";`,
    `import {
  getKaomojiRawRecordsPath,
  getPhase7RawSnapshotPath,
  getPhase8ProposedLibraryDir,
  getPhase9EditorialDir,
  getPhase10RootDir,
  getPhase11ManifestPath,
  getPhase11RootDir,
  PHASE11_PIPELINE_VERSION,
} from "../../storage/paths";`,
  );
  p = p.replace(
    `  if (rawBefore.length !== EXPECTED_RAW_BASELINE) errors.push("raw count mismatch");`,
    `  const phase7Snapshot = JSON.parse(readFileSync(getPhase7RawSnapshotPath(rootDir), "utf8")) as {
    raw_count: number;
    file_sha256: string;
  };
  const phase8BaselineRaw = phase7Snapshot.raw_count;
  const phase8BaselineSha = phase7Snapshot.file_sha256;
  if (rawBefore.length !== rawAfter.length) errors.push("raw count changed during phase 11");
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed during phase 11");
  const rawBaselineMismatch = rawBefore.length !== phase8BaselineRaw || rawShaBefore !== phase8BaselineSha;`,
  );
  p = p.replace(
    `  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed");
  if (rawAfter.length !== rawBefore.length) errors.push("RAW count changed");`,
    ``,
  );
  p = p.replace(
    `    raw_sha256: rawShaAfter,`,
    `    raw_sha256: rawShaAfter,
    phase8_baseline_raw_count: phase8BaselineRaw,
    phase8_baseline_raw_sha256: phase8BaselineSha,
    raw_baseline_mismatch: rawBaselineMismatch,`,
  );
  p = p.replace(
    `    emotion: audit.emotion,`,
    `    emotion: audit.emotion,
    emotion_confidence: audit.emotion_confidence,`,
  );
  fs.writeFileSync(pipelineFile, p, "utf8");
  console.log("patched pipeline.ts");
}
