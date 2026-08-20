import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { EXPECTED_RELEASE_ID } from "@/lib/master/integration/config";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../catalog";
import { R2_FULL_EXPORT_DIR } from "../config";
import { sha256Hex } from "../sharding";
import { buildDuplicateReport, duplicateReportSummary } from "./duplicates";
import {
  buildDirectoryReports,
  countDirectories,
  countFilesUnderPrefix,
  extensionCounts,
  providerArtworkCounts,
  scanMasterTree,
  sumBytesUnderPrefix,
} from "./scan";
import {
  FULL_ARCHIVE_BUCKET_NAME,
  FULL_ARCHIVE_PREFIX,
  FULL_ARCHIVE_SCHEMA_VERSION,
  type FullArchiveFileEntry,
  type FullArchiveFrozenReleaseEntry,
  type FullArchiveManifest,
  type FullArchivePrepareResult,
} from "./types";

const FROZEN_RELEASE_PREFIX = "release/8.10/";

export interface PrepareFullArchiveInput {
  readonly projectRoot: string;
  readonly sourceRoot?: string;
  readonly exportRootDir?: string;
  readonly canonicalRecords: readonly CanonicalEmojiRecord[];
  readonly artworkRecords: readonly ArtworkMasterRecord[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function buildChecksumsFile(files: readonly FullArchiveFileEntry[]): string {
  return files
    .map((file) => `${file.sha256}  master/${file.relativePath}`)
    .join("\n")
    .concat("\n");
}

function collectFrozenReleaseChecksums(
  files: readonly FullArchiveFileEntry[],
): FullArchiveFrozenReleaseEntry[] {
  return files
    .filter((file) => file.relativePath.startsWith(FROZEN_RELEASE_PREFIX))
    .map((file) => ({
      relativePath: file.relativePath,
      sha256: file.sha256,
      bytes: file.bytes,
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function prepareFullArchive(input: PrepareFullArchiveInput): FullArchivePrepareResult {
  const started = Date.now();
  const sourceRoot = input.sourceRoot ?? join(input.projectRoot, "src/data/master");
  const exportRootDir =
    input.exportRootDir ?? join(input.projectRoot, R2_FULL_EXPORT_DIR, FULL_ARCHIVE_PREFIX);

  if (input.canonicalRecords.length !== MASTER_IDENTITY_COUNT) {
    throw new Error(
      `Canonical identity count mismatch: expected ${MASTER_IDENTITY_COUNT}, got ${input.canonicalRecords.length}`,
    );
  }
  if (input.artworkRecords.length !== MASTER_ARTWORK_RECORD_COUNT) {
    throw new Error(
      `Artwork record count mismatch: expected ${MASTER_ARTWORK_RECORD_COUNT}, got ${input.artworkRecords.length}`,
    );
  }

  const scanned = scanMasterTree({
    sourceRoot,
    readFile: (path) => readFileSync(path),
  });

  const masterExportDir = join(exportRootDir, "master");
  const manifestsDir = join(exportRootDir, "manifests");

  for (const file of scanned) {
    const sourcePath = join(sourceRoot, file.relativePath);
    const destinationPath = join(masterExportDir, file.relativePath);
    mkdirSync(dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
  }

  const providerCountsRaw = providerArtworkCounts(scanned);
  const providerCounts = {
    openmoji: providerCountsRaw.openmoji ?? 0,
    noto: providerCountsRaw.noto ?? 0,
    twemoji: providerCountsRaw.twemoji ?? 0,
    fluent: providerCountsRaw.fluent ?? 0,
  } satisfies Record<ArtworkProvider, number>;

  const duplicateGroups = buildDuplicateReport(scanned);
  const duplicateSummary = duplicateReportSummary(duplicateGroups);
  const frozenReleaseChecksums = collectFrozenReleaseChecksums(scanned);
  const directoryReports = buildDirectoryReports(scanned);
  const totalBytes = scanned.reduce((sum, file) => sum + file.bytes, 0);
  const manifestObjects = 6;
  const r2Objects = scanned.length + manifestObjects;

  const manifestWithoutHash: Omit<FullArchiveManifest, "manifestSha256"> = {
    schemaVersion: FULL_ARCHIVE_SCHEMA_VERSION,
    archiveType: "FULL_MASTER_ARCHIVE",
    generatedAt: new Date().toISOString(),
    sourceRoot: "src/data/master",
    checksumAlgorithm: "SHA-256",
    releaseId: EXPECTED_RELEASE_ID,
    totals: {
      files: scanned.length,
      bytes: totalBytes,
      directories: countDirectories(sourceRoot),
      canonicalIdentities: input.canonicalRecords.length,
      artworkRecords: input.artworkRecords.length,
      artworkFiles: countFilesUnderPrefix(scanned, "raw/artwork"),
      artworkBytes: sumBytesUnderPrefix(scanned, "raw/artwork"),
      metadataBytes: sumBytesUnderPrefix(scanned, "metadata"),
      semanticBytes: sumBytesUnderPrefix(scanned, "semantic"),
      vendorBytes: sumBytesUnderPrefix(scanned, "raw/vendor"),
      r2Objects,
    },
    providerCounts,
    extensionCounts: extensionCounts(scanned),
    directoryReports,
    frozenReleaseChecksums,
    frozenReleaseVerified: frozenReleaseChecksums.length > 0,
    deduplicationPolicy: "PRESERVE_ALL",
    optimizedExportNote:
      "This FULL_MASTER_ARCHIVE preserves every source file. The separate optimized export at .r2-export/emojiquick/ is for runtime application data only.",
  };

  const manifestBody = JSON.stringify(manifestWithoutHash, null, 2);
  const manifestSha256 = sha256Hex(manifestBody);
  const manifest: FullArchiveManifest = {
    ...manifestWithoutHash,
    manifestSha256,
  };

  writeJson(join(manifestsDir, "master-manifest.json"), manifest);
  writeText(join(manifestsDir, "checksums.sha256"), buildChecksumsFile(scanned));
  writeJson(join(manifestsDir, "file-counts.json"), {
    totalFiles: scanned.length,
    canonicalIdentities: input.canonicalRecords.length,
    artworkRecords: input.artworkRecords.length,
    artworkFiles: manifest.totals.artworkFiles,
    providerCounts,
    extensionCounts: manifest.extensionCounts,
    r2Objects,
  });
  writeJson(join(manifestsDir, "size-report.json"), {
    totalBytes,
    totalGigabytesDecimal: totalBytes / 1e9,
    totalGibibytesBinary: totalBytes / 1024 ** 3,
    artworkBytes: manifest.totals.artworkBytes,
    metadataBytes: manifest.totals.metadataBytes,
    semanticBytes: manifest.totals.semanticBytes,
    vendorBytes: manifest.totals.vendorBytes,
    r2FreeAllowanceBytes: 10_000_000_000,
    utilizationPercent: (totalBytes / 10_000_000_000) * 100,
    remainingBytes: 10_000_000_000 - totalBytes,
  });
  writeJson(join(manifestsDir, "duplicate-report.json"), {
    policy: "PRESERVE_ALL",
    note: "Duplicates are recorded but never removed from the full archive.",
    ...duplicateSummary,
    groups: duplicateGroups,
  });
  writeJson(join(manifestsDir, "source-tree-report.json"), {
    sourceRoot: "src/data/master",
    bucketName: FULL_ARCHIVE_BUCKET_NAME,
    archivePrefix: FULL_ARCHIVE_PREFIX,
    masterPrefix: "master/",
    directoryReports,
    topLevelComponents: directoryReports.filter((entry) => !entry.path.includes("/")),
  });

  return {
    manifest,
    exportRootDir,
    files: scanned,
    durationMs: Date.now() - started,
  };
}
