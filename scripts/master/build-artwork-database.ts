import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildArtworkDatabase,
  type ArtworkProvider,
  type ProviderLicenseInfo,
} from "../../src/lib/master/artwork/build";
import type { ArtworkDatabaseManifest } from "../../src/lib/master/artwork/types";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const masterDir = join(rootDir, "src", "data", "master");
const artworkDir = join(masterDir, "artwork");
const rawDir = join(masterDir, "raw");

interface MasterSourceLockFile {
  sources: Array<{
    source: string;
    version: string;
    license: string;
    licenseURL: string;
    attribution: string | null;
    copyright?: string | null;
    sourceURL: string;
  }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function verifyFileUnchanged(path: string, expectedCount: number): number {
  const data = readJson<unknown[]>(path);
  if (data.length !== expectedCount) {
    throw new Error(`Production file changed: ${path} expected ${expectedCount}, got ${data.length}`);
  }
  return data.length;
}

function providerLicenseMap(lock: MasterSourceLockFile): Record<ArtworkProvider, ProviderLicenseInfo> {
  const providers: ArtworkProvider[] = ["openmoji", "noto", "twemoji", "fluent"];
  const map = {} as Record<ArtworkProvider, ProviderLicenseInfo>;

  for (const provider of providers) {
    const entry = lock.sources.find((source) => source.source === provider);
    if (!entry) {
      throw new Error(`Missing lock entry for provider: ${provider}`);
    }

    map[provider] = {
      license: entry.license,
      licenseURL: entry.licenseURL,
      attribution: entry.attribution ?? entry.copyright ?? provider,
      sourceURL: entry.sourceURL,
      copyright: entry.copyright ?? null,
      sourceVersion: entry.version,
    };
  }

  return map;
}

function main(): void {
  verifyFileUnchanged(join(rootDir, "src", "data", "emojis.json"), 3944);
  verifyFileUnchanged(join(rootDir, "src", "data", "openmoji-extras.json"), 542);

  const canonicalRecords = readJson<Array<{ canonicalId: string }>>(
    join(masterDir, "canonical-emojis.json"),
  );
  const canonicalIds = canonicalRecords.map((record) => record.canonicalId);
  if (canonicalIds.length !== 6955) {
    throw new Error(`Canonical identity count changed: expected 6955, got ${canonicalIds.length}`);
  }

  const rawArtworkRecords = readJson<import("../../src/lib/master/artwork/build").RawArtworkRecord[]>(
    join(rawDir, "raw-artwork-records.json"),
  );
  const artworkIdentityIndex = readJson<import("../../src/lib/master/artwork/build").ArtworkIdentityMapping[]>(
    join(masterDir, "identity", "artwork-identity-index.json"),
  );
  const lock = readJson<MasterSourceLockFile>(join(rootDir, "src", "data", "master-source-lock.json"));

  const result = buildArtworkDatabase({
    rawArtworkRecords,
    artworkIdentityIndex,
    canonicalIds,
    rawArtworkRoot: rawDir,
    providerLicenses: providerLicenseMap(lock),
  });

  const manifest: ArtworkDatabaseManifest = {
    generatedAt: new Date().toISOString(),
    phase: "8.5",
    recordCount: result.artworkMasterIndex.length,
    files: {
      artworkMasterIndex: "master/artwork/artwork-master-index.json",
      artworkChecksums: "master/artwork/artwork-checksums.json",
      canonicalArtworkIndex: "master/artwork/canonical-artwork-index.json",
      artworkCoverageReport: "master/artwork/artwork-coverage-report.json",
      artworkLicenseIndex: "master/artwork/artwork-license-index.json",
      artworkAttributionIndex: "master/artwork/artwork-attribution-index.json",
      artworkIntegrityReport: "master/artwork/artwork-integrity-report.json",
    },
  };

  writeJson(join(artworkDir, "artwork-master-index.json"), result.artworkMasterIndex);
  writeJson(join(artworkDir, "artwork-checksums.json"), result.artworkChecksums);
  writeJson(join(artworkDir, "canonical-artwork-index.json"), result.canonicalArtworkIndex);
  writeJson(join(artworkDir, "artwork-coverage-report.json"), result.artworkCoverageReport);
  writeJson(join(artworkDir, "artwork-license-index.json"), result.artworkLicenseIndex);
  writeJson(join(artworkDir, "artwork-attribution-index.json"), result.artworkAttributionIndex);
  writeJson(join(artworkDir, "artwork-integrity-report.json"), result.integrityReport);
  writeJson(join(artworkDir, "artwork-manifest.json"), manifest);

  console.log("Phase 8.5 artwork database built.");
  console.log(JSON.stringify(result.integrityReport.totals, null, 2));
  console.log(JSON.stringify(result.integrityReport.providerCounts, null, 2));
  console.log(JSON.stringify(result.integrityReport.canonicalCoverage, null, 2));
}

main();
