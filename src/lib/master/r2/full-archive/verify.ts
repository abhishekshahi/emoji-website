import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../catalog";
import { sha256Hex } from "../sharding";
import type { FullArchiveManifest, FullArchiveVerifyResult } from "./types";

export interface VerifyFullArchiveInput {
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly exportRootDir: string;
  readonly canonicalRecords: readonly CanonicalEmojiRecord[];
  readonly artworkRecords: readonly ArtworkMasterRecord[];
  readonly deep?: boolean;
}

interface ParsedChecksumEntry {
  readonly relativePath: string;
  readonly sha256: string;
}

function readManifest(exportRootDir: string): FullArchiveManifest {
  const manifestPath = join(exportRootDir, "manifests", "master-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing full archive manifest: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8")) as FullArchiveManifest;
}

function parseChecksumsFile(content: string): ParsedChecksumEntry[] {
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha256, ...pathParts] = line.split(/\s+/);
      const prefixedPath = pathParts.join(" ");
      const relativePath = prefixedPath.replace(/^master\//, "");
      return { sha256, relativePath };
    });
}

async function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function walkFiles(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

async function verifyTreeAgainstChecksums(
  rootDir: string,
  checksums: ReadonlyMap<string, string>,
  label: string,
  errors: string[],
): Promise<{ fileCount: number; totalBytes: number; checksumMismatches: number; missing: number; unexpected: number }> {
  const absolutePaths: string[] = [];
  walkFiles(rootDir, absolutePaths);

  const seen = new Set<string>();
  let totalBytes = 0;
  let checksumMismatches = 0;
  let missing = 0;
  let unexpected = 0;

  for (const absolutePath of absolutePaths) {
    const relativePath = relative(rootDir, absolutePath).replace(/\\/g, "/");
    seen.add(relativePath);
    const expectedHash = checksums.get(relativePath);
    if (!expectedHash) {
      unexpected += 1;
      errors.push(`Unexpected ${label} file: ${relativePath}`);
      continue;
    }

    const stats = statSync(absolutePath);
    totalBytes += stats.size;
    const actualHash = await hashFile(absolutePath);
    if (actualHash !== expectedHash) {
      checksumMismatches += 1;
      errors.push(`${label} checksum mismatch: ${relativePath}`);
    }
  }

  for (const relativePath of checksums.keys()) {
    if (!seen.has(relativePath)) {
      missing += 1;
      errors.push(`Missing ${label} file: ${relativePath}`);
    }
  }

  return { fileCount: absolutePaths.length, totalBytes, checksumMismatches, missing, unexpected };
}

function verifyManifestIntegrity(
  exportRootDir: string,
  manifest: FullArchiveManifest,
  errors: string[],
): void {
  const manifestPath = join(exportRootDir, "manifests", "master-manifest.json");
  const manifestRaw = readFileSync(manifestPath, "utf8");
  const manifestParsed = JSON.parse(manifestRaw) as Omit<FullArchiveManifest, "manifestSha256"> & {
    manifestSha256: string;
  };
  const { manifestSha256: _ignored, ...manifestWithoutHash } = manifestParsed;
  const expectedManifestHash = sha256Hex(JSON.stringify(manifestWithoutHash, null, 2));
  if (manifest.manifestSha256 !== expectedManifestHash) {
    errors.push("Master manifest self-checksum mismatch");
  }
}

function verifyFrozenReleaseFromManifest(manifest: FullArchiveManifest, errors: string[]): void {
  if (!manifest.frozenReleaseVerified || manifest.frozenReleaseChecksums.length === 0) {
    errors.push("Frozen release checksums missing from manifest");
  }
}

export async function verifyFullArchive(input: VerifyFullArchiveInput): Promise<FullArchiveVerifyResult> {
  const errors: string[] = [];
  const manifest = readManifest(input.exportRootDir);
  const checksumsPath = join(input.exportRootDir, "manifests", "checksums.sha256");

  if (!existsSync(checksumsPath)) {
    return {
      status: "FAIL",
      errors: [`Missing checksums file: ${checksumsPath}`],
      manifest,
      measured: {
        sourceFiles: 0,
        exportFiles: 0,
        sourceBytes: 0,
        exportBytes: 0,
        checksumMismatches: 0,
        missingInExport: 0,
        unexpectedInExport: 0,
      },
    };
  }

  const checksumEntries = parseChecksumsFile(readFileSync(checksumsPath, "utf8"));
  const checksumMap = new Map<string, string>(
    checksumEntries.map((entry) => [entry.relativePath, entry.sha256]),
  );

  const exportMasterDir = join(input.exportRootDir, "master");
  const exportStats = await verifyTreeAgainstChecksums(exportMasterDir, checksumMap, "export", errors);

  let sourceFiles = exportStats.fileCount;
  let sourceBytes = exportStats.totalBytes;
  let checksumMismatches = exportStats.checksumMismatches;
  let missingInExport = exportStats.missing;
  let unexpectedInExport = exportStats.unexpected;

  if (input.deep) {
    const sourceStats = await verifyTreeAgainstChecksums(input.sourceRoot, checksumMap, "source", errors);
    sourceFiles = sourceStats.fileCount;
    sourceBytes = sourceStats.totalBytes;
    checksumMismatches += sourceStats.checksumMismatches;
    missingInExport += sourceStats.missing;
    unexpectedInExport += sourceStats.unexpected;
  }

  if (checksumEntries.length !== manifest.totals.files) {
    errors.push(`Checksum entry count mismatch: ${checksumEntries.length} vs manifest ${manifest.totals.files}`);
  }
  if (exportStats.totalBytes !== manifest.totals.bytes) {
    errors.push(`Manifest byte count mismatch: manifest ${manifest.totals.bytes}, export ${exportStats.totalBytes}`);
  }
  if (input.canonicalRecords.length !== MASTER_IDENTITY_COUNT) {
    errors.push(`Canonical identity count mismatch: ${input.canonicalRecords.length}`);
  }
  if (input.artworkRecords.length !== MASTER_ARTWORK_RECORD_COUNT) {
    errors.push(`Artwork record count mismatch: ${input.artworkRecords.length}`);
  }
  if (manifest.totals.canonicalIdentities !== MASTER_IDENTITY_COUNT) {
    errors.push(`Manifest identity count mismatch: ${manifest.totals.canonicalIdentities}`);
  }
  if (manifest.totals.artworkRecords !== MASTER_ARTWORK_RECORD_COUNT) {
    errors.push(`Manifest artwork record mismatch: ${manifest.totals.artworkRecords}`);
  }

  verifyManifestIntegrity(input.exportRootDir, manifest, errors);
  verifyFrozenReleaseFromManifest(manifest, errors);

  return {
    status: errors.length === 0 ? "PASS" : "FAIL",
    errors,
    manifest,
    measured: {
      sourceFiles,
      exportFiles: exportStats.fileCount,
      sourceBytes,
      exportBytes: exportStats.totalBytes,
      checksumMismatches,
      missingInExport,
      unexpectedInExport,
    },
  };
}