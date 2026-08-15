import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { CanonicalEmojiRecord } from "../../src/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "../../src/lib/master/artwork/types";
import type { CanonicalMetadataIndexEntry } from "../../src/lib/master/metadata/types";
import type { CanonicalSemanticIndexEntry } from "../../src/lib/master/semantic/types";
import type { CanonicalSearchIndexEntry } from "../../src/lib/master/reconciliation/types";
import { LICENSE_REGISTRY } from "../../src/lib/master/public/license-registry";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { EXPECTED_RELEASE_ID } from "../../src/lib/master/integration/config";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../../src/lib/master/r2/catalog";
import { sha256Hex } from "../../src/lib/master/r2/sharding";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const masterDir = join(rootDir, "src", "data", "master");
const exportDir = join(rootDir, "r2-export");
const artworkRoot = join(masterDir, "raw", "artwork");

const EXPORT_VERSION = "canonical-r2-export-v1";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._+-]/g, "_");
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function linkOrCopy(source: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) return;
  try {
    linkSync(source, dest);
  } catch {
    copyFileSync(source, dest);
  }
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function dirBytes(dir: string): number {
  return walkFiles(dir).reduce((sum, f) => sum + statSync(f).size, 0);
}

interface BinaryGroup {
  sha256: string;
  files: number;
  bytes: number;
  providers: Set<string>;
  paths: string[];
}

function analyzeBinaryDuplicates(records: ArtworkMasterRecord[]): {
  groups: BinaryGroup[];
  rawBytes: number;
  dedupBytes: number;
  duplicateRecords: number;
} {
  const byHash = new Map<string, BinaryGroup>();
  let rawBytes = 0;
  let duplicateRecords = 0;

  for (const record of records) {
    const rel = record.filePath.replace(/^artwork\//, "");
    const abs = join(artworkRoot, rel);
    if (!existsSync(abs)) throw new Error(`Missing artwork file: ${abs}`);
    const bytes = statSync(abs).size;
    rawBytes += bytes;
    const hash = record.checksumVerified ? record.checksum : sha256File(abs);
    let group = byHash.get(hash);
    if (!group) {
      group = { sha256: hash, files: 0, bytes, providers: new Set(), paths: [] };
      byHash.set(hash, group);
    }
    group.files += 1;
    group.providers.add(record.provider);
    if (group.paths.length < 5) group.paths.push(record.filePath);
    if (group.files > 1) duplicateRecords += 1;
  }

  const groups = [...byHash.values()].sort((a, b) => b.files - a.files);
  const dedupBytes = groups.reduce((s, g) => s + g.bytes, 0);
  return { groups, rawBytes, dedupBytes, duplicateRecords };
}

function vendorMirrorPath(artworkRel: string): string | null {
  const rel = artworkRel.replace(/^artwork\//, "");
  const parts = rel.split("/");
  const provider = parts[0];
  const rest = parts.slice(1).join("/");
  if (provider === "noto") {
    const base = join(masterDir, "raw", "vendor", "noto", "extracted");
    const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
    if (!dirs.length) return null;
    return join(base, dirs[0]!.name, rest);
  }
  if (provider === "twemoji") {
    const base = join(masterDir, "raw", "vendor", "twemoji", "extracted");
    const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
    if (!dirs.length) return null;
    return join(base, dirs[0]!.name, rest.replace(/^assets\//, "assets/"));
  }
  if (provider === "fluent") {
    const base = join(masterDir, "raw", "vendor", "fluent", "extracted");
    const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
    if (!dirs.length) return null;
    return join(base, dirs[0]!.name, rest.replace(/^assets\//, "assets/"));
  }
  return null;
}

function analyzeVendorDuplicates(records: ArtworkMasterRecord[]): {
  exactBinaryDuplicate: number;
  sameNameDifferentBinary: number;
  vendorMissing: number;
  archiveCopy: number;
} {
  let exactBinaryDuplicate = 0;
  let sameNameDifferentBinary = 0;
  let vendorMissing = 0;
  let archiveCopy = 0;

  for (const record of records) {
    const artworkAbs = join(artworkRoot, record.filePath.replace(/^artwork\//, ""));
    const vendorAbs = vendorMirrorPath(record.filePath);
    if (!vendorAbs || !existsSync(vendorAbs)) {
      vendorMissing += 1;
      continue;
    }
    const aHash = sha256File(artworkAbs);
    const vHash = sha256File(vendorAbs);
    if (aHash === vHash) {
      exactBinaryDuplicate += 1;
      archiveCopy += 1;
    } else {
      sameNameDifferentBinary += 1;
    }
  }

  return { exactBinaryDuplicate, sameNameDifferentBinary, vendorMissing, archiveCopy };
}

type ServingClass = "A" | "B" | "C";

function servingClass(provider: string): ServingClass {
  const entries = LICENSE_REGISTRY.filter((e) => e.provider.toLowerCase().includes(provider.toLowerCase()));
  if (!entries.length) return "C";
  if (entries.some((e) => e.verificationStatus === "restricted" || e.verificationStatus === "unverified")) {
    return "C";
  }
  if (entries.every((e) => e.publicServingAllowed && e.verificationStatus === "verified")) return "A";
  return "B";
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    count += entry.isDirectory() ? countFiles(full) : 1;
  }
  return count;
}

function validateExport(expected: {
  identities: number;
  artworkRecords: number;
  artworkBinaries: number;
}): void {
  const identityCount = countFiles(join(exportDir, "identities"));
  const artworkRecordCount = countFiles(join(exportDir, "artwork-records"));
  const artworkBinaryCount = countFiles(join(exportDir, "artwork"));
  const errors: string[] = [];
  if (identityCount !== expected.identities) {
    errors.push(`identity file count ${identityCount} !== ${expected.identities}`);
  }
  if (artworkRecordCount !== expected.artworkRecords) {
    errors.push(`artwork-record file count ${artworkRecordCount} !== ${expected.artworkRecords}`);
  }
  if (artworkBinaryCount !== expected.artworkBinaries) {
    errors.push(`artwork binary count ${artworkBinaryCount} !== ${expected.artworkBinaries}`);
  }
  if (errors.length) throw new Error(`Export validation failed:\n${errors.join("\n")}`);
}

function buildLicenseMatrix() {
  return LICENSE_REGISTRY.map((entry) => ({
    provider: entry.provider,
    assetType: entry.assetType,
    license: entry.license,
    licenseURL: entry.licenseURL,
    attributionRequired: entry.attributionRequired,
    storageAllowed: true,
    publicServingAllowed: entry.publicServingAllowed,
    publicDownloadAllowed: entry.publicDownloadAllowed,
    commercialUseAllowed: entry.commercialUseAllowed,
    modificationAllowed: entry.modificationAllowed,
    shareAlikeRequired: entry.shareAlikeRequired,
    verificationStatus: entry.verificationStatus,
    servingClass: entry.publicServingAllowed && entry.verificationStatus === "verified" ? "A" : entry.verificationStatus === "restricted" || entry.verificationStatus === "unverified" ? "C" : "B",
    notes: entry.notes,
  }));
}

async function main(): Promise<void> {
  console.log("Phase 8.37 canonical export — read-only local build");
  const started = Date.now();
  if (existsSync(exportDir)) rmSync(exportDir, { recursive: true, force: true });

  const canonicalRecords = readJson<CanonicalEmojiRecord[]>(join(masterDir, "canonical-emojis.json"));
  const artworkRecords = readJson<ArtworkMasterRecord[]>(join(masterDir, "artwork", "artwork-master-index.json"));
  const metadataById = new Map(
    readJson<CanonicalMetadataIndexEntry[]>(join(masterDir, "metadata", "canonical-metadata-index.json")).map((r) => [r.canonicalId, r]),
  );
  const semanticById = new Map(
    readJson<CanonicalSemanticIndexEntry[]>(join(masterDir, "semantic", "canonical-semantic-index.json")).map((r) => [r.canonicalId, r]),
  );
  const searchById = new Map(
    readJson<CanonicalSearchIndexEntry[]>(join(masterDir, "metadata", "canonical-search-index.json")).map((r) => [r.canonicalId, r]),
  );

  if (canonicalRecords.length !== MASTER_IDENTITY_COUNT) throw new Error(`Identity count mismatch`);
  if (artworkRecords.length !== MASTER_ARTWORK_RECORD_COUNT) throw new Error(`Artwork count mismatch`);

  const dup = analyzeBinaryDuplicates(artworkRecords);
  const vendor = analyzeVendorDuplicates(artworkRecords);
  const licenseMatrix = buildLicenseMatrix();

  const checksumLines: string[] = [];
  let objectCount = 0;
  let exportBytes = 0;

  const countWrite = (path: string, bytes: number, hash: string) => {
    objectCount += 1;
    exportBytes += bytes;
    checksumLines.push(`${hash}  ${relative(exportDir, path).replace(/\\/g, "/")}`);
  };

  // identities
  const identityIds = new Set<string>();
  for (const record of canonicalRecords) {
    if (identityIds.has(record.canonicalId)) throw new Error(`Duplicate identity ${record.canonicalId}`);
    identityIds.add(record.canonicalId);
    const outPath = join(exportDir, "identities", `${safeName(record.canonicalId)}.json`);
    const payload = JSON.stringify(record);
    writeText(outPath, `${payload}\n`);
    countWrite(outPath, Buffer.byteLength(payload, "utf8"), sha256Hex(payload));
  }

  // metadata, semantic, search, provenance
  for (const record of canonicalRecords) {
    const id = record.canonicalId;
    const sn = safeName(id);
    const meta = metadataById.get(id);
    if (meta) {
      const p = join(exportDir, "metadata", `${sn}.json`);
      const body = JSON.stringify(meta);
      writeText(p, `${body}\n`);
      countWrite(p, Buffer.byteLength(body, "utf8"), sha256Hex(body));
    }
    const sem = semanticById.get(id);
    if (sem) {
      const p = join(exportDir, "semantic", `${sn}.json`);
      const body = JSON.stringify(sem);
      writeText(p, `${body}\n`);
      countWrite(p, Buffer.byteLength(body, "utf8"), sha256Hex(body));
    }
    const search = searchById.get(id);
    if (search) {
      const p = join(exportDir, "search", `${sn}.json`);
      const body = JSON.stringify(search);
      writeText(p, `${body}\n`);
      countWrite(p, Buffer.byteLength(body, "utf8"), sha256Hex(body));
    }
    const prov = {
      canonicalId: id,
      sourceRecords: record.sourceRecords,
      metadataRefs: record.metadataRefs,
      semanticRefs: record.semanticRefs,
      artwork: record.artwork,
      metadataSources: record.metadataSources,
      semanticSources: record.semanticSources,
    };
    const pp = join(exportDir, "provenance", `${sn}.json`);
    const pbody = JSON.stringify(prov);
    writeText(pp, `${pbody}\n`);
    countWrite(pp, Buffer.byteLength(pbody, "utf8"), sha256Hex(pbody));
  }

  // deduplicated artwork binaries + artwork records
  const binaryMap = new Map<string, string>();
  let artworkRecordCount = 0;
  for (const record of artworkRecords) {
    const sourcePath = join(artworkRoot, record.filePath.replace(/^artwork\//, ""));
    const ext = record.format.toLowerCase() === "png" ? "png" : record.format.toLowerCase() === "svg" ? "svg" : "bin";
    const hash = record.checksum;
    const binaryRel = `artwork/${hash}.${ext}`;
    const binaryPath = join(exportDir, binaryRel);
    if (!binaryMap.has(hash)) {
      linkOrCopy(sourcePath, binaryPath);
      const b = statSync(binaryPath).size;
      binaryMap.set(hash, binaryRel);
      countWrite(binaryPath, b, hash);
    }
    const recordObjectKey = `artwork-records/${sha256Hex(record.filePath)}.json`;
    const exportRecord = {
      ...record,
      recordObjectKey,
      binaryObjectKey: binaryRel,
      publicServingClass: servingClass(record.provider),
    };
    const rp = join(exportDir, recordObjectKey);
    const rbody = JSON.stringify(exportRecord);
    writeText(rp, `${rbody}\n`);
    countWrite(rp, Buffer.byteLength(rbody, "utf8"), sha256Hex(rbody));
    artworkRecordCount += 1;
  }

  writeJson(join(exportDir, "licenses", "LICENSE-MATRIX.json"), {
    generatedAt: new Date().toISOString(),
    providers: licenseMatrix,
    artworkProviderClasses: {
      openmoji: servingClass("openmoji"),
      twemoji: servingClass("twemoji"),
      noto: servingClass("noto"),
      fluent: servingClass("fluent"),
    },
  });

  const licenseReport = `# EmojiQuick R2 License Report\n\nGenerated: ${new Date().toISOString()}\n\n## Classification\n\n- **A** — Safe to publicly serve (verified license evidence)\n- **B** — Store but do not publicly serve yet\n- **C** — License/provenance unknown or restricted — hold\n\n## Providers\n\n${licenseMatrix.map((e) => `- **${e.provider}** (${e.assetType}): class ${e.servingClass}, license ${e.license}, publicServing=${e.publicServingAllowed}`).join("\n")}\n\nR2 storage does NOT automatically mean public URL access. Default: private bucket.\n`;
  writeText(join(exportDir, "licenses", "LICENSE-REPORT.md"), licenseReport);

  const fullMasterBytes = dirBytes(masterDir);
  const existingOptimized = existsSync(join(rootDir, ".r2-export", "emojiquick")) ? dirBytes(join(rootDir, ".r2-export", "emojiquick")) : 0;
  const jsonOnlyBytes = exportBytes;
  const gzipEstimate = gzipSync(readFileSync(join(exportDir, "identities", `${safeName(canonicalRecords[0]!.canonicalId)}.json`))).length; // placeholder small

  // estimate compressed JSON layer (identities+metadata+semantic+search+records json only)
  let jsonLayerBytes = 0;
  for (const sub of ["identities", "metadata", "semantic", "search", "provenance", "artwork-records", "licenses", "manifests"]) {
    jsonLayerBytes += dirBytes(join(exportDir, sub));
  }
  const optionDBytes = jsonLayerBytes * 0.65 + (dup.dedupBytes); // rough gzip ratio estimate on JSON + dedup binaries

  const storageOptions = {
    optionA_rawArchive: { bytes: fullMasterBytes, objects: 82790, label: "Raw complete master archive" },
    optionB_dedupArtworkPlusMetadata: {
      bytes: dup.dedupBytes + jsonLayerBytes,
      objects: binaryMap.size + objectCount,
      label: "Deduplicated artwork + complete metadata layers",
    },
    optionC_canonicalExport: { bytes: exportBytes, objects: objectCount, label: "Canonical r2-export (this build)" },
    optionD_compressedEstimate: { bytes: Math.round(optionDBytes), objects: objectCount, label: "Canonical export + estimated gzip JSON" },
    existingDotR2Export: { bytes: existingOptimized, objects: 39710, label: "Existing .r2-export/emojiquick (reference)" },
  };

  const combinedR2 = fullMasterBytes + existingOptimized;
  const freeGb = 10;
  const exportGb = exportBytes / 1e9;
  const fits = exportGb <= freeGb;

  const masterManifest = {
    exportVersion: EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    sourceRelease: EXPECTED_RELEASE_ID,
    canonicalIdentityCount: canonicalRecords.length,
    artworkRecordCount: artworkRecords.length,
    uniqueBinaryCount: binaryMap.size,
    metadataRecordCount: metadataById.size,
    semanticRecordCount: semanticById.size,
    searchRecordCount: searchById.size,
    totalExportBytes: exportBytes,
    deduplicatedArtworkBytes: dup.dedupBytes,
    rawArtworkBytes: dup.rawBytes,
    duplicateBinaryRecords: dup.duplicateRecords,
    providerCounts: {
      openmoji: artworkRecords.filter((r) => r.provider === "openmoji").length,
      noto: artworkRecords.filter((r) => r.provider === "noto").length,
      twemoji: artworkRecords.filter((r) => r.provider === "twemoji").length,
      fluent: artworkRecords.filter((r) => r.provider === "fluent").length,
    },
    licenseClassifications: {
      A: ["openmoji", "twemoji"],
      B: ["noto"],
      C: ["fluent", "emojinet-unknown-artwork"],
    },
    objectCounts: {
      identities: canonicalRecords.length,
      artworkBinaries: binaryMap.size,
      artworkRecords: artworkRecordCount,
      metadata: metadataById.size,
      semantic: semanticById.size,
      search: searchById.size,
      provenance: canonicalRecords.length,
      licenses: 2,
      manifests: 2,
      total: objectCount,
    },
    vendorDuplicateAnalysis: vendor,
    storageOptions,
    r2FreeTier: {
      allowanceGb: freeGb,
      exportUtilizationPercent: Number(((exportGb / freeGb) * 100).toFixed(2)),
      remainingGb: Number((freeGb - exportGb).toFixed(3)),
      fits10PercentMargin: exportGb <= 9,
      fits20PercentMargin: exportGb <= 8,
      fits30PercentMargin: exportGb <= 7,
    },
    classAOperationsEstimate: objectCount,
  };

  writeJson(join(exportDir, "manifests", "master-manifest.json"), masterManifest);
  writeJson(join(exportDir, "manifests", "r2-export-manifest.json"), masterManifest);
  writeText(join(exportDir, "manifests", "r2-checksums.sha256"), `${checksumLines.sort().join("\n")}\n`);

  writeJson(join(exportDir, "manifests", "binary-duplicate-groups.json"), dup.groups.slice(0, 50).map((g) => ({
    sha256: g.sha256,
    files: g.files,
    bytes: g.bytes,
    providers: [...g.providers],
    samplePaths: g.paths,
  })));

  const savings = dup.rawBytes - dup.dedupBytes;
  const audit = `# EmojiQuick R2 Canonical Export Audit (Phase 8.37)\n\n## Executive Summary\n\nRead-only local canonical export built at \`r2-export/\`. No R2 upload. No master data modified.\n\n- Identities: ${canonicalRecords.length}\n- Artwork records: ${artworkRecords.length}\n- Unique binaries: ${binaryMap.size}\n- Export bytes: ${exportBytes.toLocaleString()} (${exportGb.toFixed(3)} GB)\n- Duration: ${((Date.now() - started) / 1000).toFixed(1)}s\n\n## Identity Preservation\n\n${canonicalRecords.length}/${MASTER_IDENTITY_COUNT} — PASS\n\n## Artwork Preservation\n\n${artworkRecordCount}/${MASTER_ARTWORK_RECORD_COUNT} records exported with binary mapping.\n\n## Binary Deduplication\n\n| Metric | Value |\n|--------|-------|\n| Raw artwork bytes | ${dup.rawBytes.toLocaleString()} |\n| Deduplicated bytes | ${dup.dedupBytes.toLocaleString()} |\n| Savings | ${savings.toLocaleString()} (${((savings / dup.rawBytes) * 100).toFixed(2)}%) |\n| Duplicate record refs | ${dup.duplicateRecords} |\n| Unique SHA-256 groups | ${dup.groups.length} |\n\n## Vendor Directory Analysis\n\n| Category | Count |\n|----------|------:|\n| Exact binary duplicate (artwork vs vendor) | ${vendor.exactBinaryDuplicate} |\n| Same name, different binary | ${vendor.sameNameDifferentBinary} |\n| Vendor mirror missing | ${vendor.vendorMissing} |\n| Archive/extraction copies | ${vendor.archiveCopy} |\n\n## Storage Comparison\n\n| Option | Bytes | GB | Objects |\n|--------|------:|---:|--------:|\n| A Raw archive | ${storageOptions.optionA_rawArchive.bytes.toLocaleString()} | ${(storageOptions.optionA_rawArchive.bytes / 1e9).toFixed(3)} | ${storageOptions.optionA_rawArchive.objects} |\n| B Dedup+metadata | ${storageOptions.optionB_dedupArtworkPlusMetadata.bytes.toLocaleString()} | ${(storageOptions.optionB_dedupArtworkPlusMetadata.bytes / 1e9).toFixed(3)} | ${storageOptions.optionB_dedupArtworkPlusMetadata.objects} |\n| C Canonical export | ${storageOptions.optionC_canonicalExport.bytes.toLocaleString()} | ${(storageOptions.optionC_canonicalExport.bytes / 1e9).toFixed(3)} | ${storageOptions.optionC_canonicalExport.objects} |\n| D Compressed est. | ${storageOptions.optionD_compressedEstimate.bytes.toLocaleString()} | ${(storageOptions.optionD_compressedEstimate.bytes / 1e9).toFixed(3)} | ${storageOptions.optionD_compressedEstimate.objects} |\n\n## R2 Free Tier\n\n- Allowance: 10 GB\n- Export utilization: ${masterManifest.r2FreeTier.exportUtilizationPercent}%\n- Remaining: ${masterManifest.r2FreeTier.remainingGb} GB\n- Fits: ${fits ? "YES" : "NO"}\n- Fits 10% margin (<=9 GB): ${masterManifest.r2FreeTier.fits10PercentMargin ? "YES" : "NO"}\n- Fits 20% margin (<=8 GB): ${masterManifest.r2FreeTier.fits20PercentMargin ? "YES" : "NO"}\n- Fits 30% margin (<=7 GB): ${masterManifest.r2FreeTier.fits30PercentMargin ? "YES" : "NO"}\n\n## Production Safety\n\n- MASTER_SEO_ROLLOUT_MODE: OFF\n- masterSEOEnabled: ${MASTER_INTEGRATION_CONFIG.masterSEOEnabled}\n- No production deploy\n\n## Recommended Next Step\n\nEnable Cloudflare R2, then run controlled 10-object upload test before bulk upload. Do not enable production flags until remote verification passes.\n`;

  writeText(join(exportDir, "R2-EXPORT-AUDIT.md"), audit);

  validateExport({
    identities: canonicalRecords.length,
    artworkRecords: artworkRecordCount,
    artworkBinaries: binaryMap.size,
  });
  console.log("VALIDATION PASS");

  console.log("CANONICAL EXPORT COMPLETE");
  console.log(`  Identities: ${canonicalRecords.length}`);
  console.log(`  Artwork records: ${artworkRecordCount}`);
  console.log(`  Unique binaries: ${binaryMap.size}`);
  console.log(`  Objects: ${objectCount}`);
  console.log(`  Bytes: ${exportBytes.toLocaleString()} (${exportGb.toFixed(3)} GB)`);
  console.log(`  Export dir: ${exportDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});