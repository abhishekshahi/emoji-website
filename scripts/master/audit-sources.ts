import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  MasterAuditReport,
  MasterSourceAuditEntry,
  MasterSourceId,
  MasterSourceLockEntry,
  MasterSourceLockFile,
} from "../../src/lib/master/types";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lockPath = join(rootDir, "src", "data", "master-source-lock.json");
const auditPath = join(rootDir, "src", "data", "master-audit-8.1.json");
const sourcesDir = join(rootDir, "src", "data", "master-sources");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function countSvgFiles(directory: string): number {
  if (!existsSync(directory)) {
    return 0;
  }

  return readdirSync(directory).filter((file) => file.endsWith(".svg")).length;
}

function getInstalledPackageVersion(packageName: string): string | null {
  const packageJsonPath = join(rootDir, "node_modules", packageName, "package.json");

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return readJson<{ version: string }>(packageJsonPath).version;
}

function getExistingProjectCounts() {
  const emojis = readJson<unknown[]>(join(rootDir, "src", "data", "emojis.json"));
  const extras = readJson<unknown[]>(
    join(rootDir, "src", "data", "openmoji-extras.json"),
  );

  return {
    standardRecords: emojis.length,
    extrasRecords: extras.length,
    searchableItems: emojis.length + extras.length,
    openmojiArtwork: {
      standard: countSvgFiles(join(rootDir, "public", "openmoji", "standard")),
      extrasOpenmoji: countSvgFiles(
        join(rootDir, "public", "openmoji", "extras-openmoji"),
      ),
      extrasUnicode: countSvgFiles(
        join(rootDir, "public", "openmoji", "extras-unicode"),
      ),
    },
  };
}

function auditLocalUnicodeSource(): Partial<MasterSourceAuditEntry> {
  const manifestPath = join(rootDir, "data", "unicode-source.manifest.json");
  const unicodeDir = join(rootDir, "data", "unicode-source");

  if (!existsSync(manifestPath)) {
    return {
      status: "missing",
      notes: ["unicode-source.manifest.json not found"],
    };
  }

  const manifest = readJson<{ emojiVersion: string; files: string[] }>(manifestPath);
  const filesPresent = manifest.files.filter((file) =>
    existsSync(join(unicodeDir, file)),
  );

  return {
    status: filesPresent.length === manifest.files.length ? "installed" : "available",
    versionInstalled: manifest.emojiVersion,
    rawRecords: null,
    rawMetadata: filesPresent.length,
    notes: [
      `Unicode source files present: ${filesPresent.join(", ")}`,
      "emoji-data.txt not yet vendored locally (planned 8.2).",
    ],
  };
}

function auditOpenMoji(existing: ReturnType<typeof getExistingProjectCounts>) {
  const version = getInstalledPackageVersion("openmoji");

  return {
    status: version === "17.0.0" ? "installed" : version ? "available" : "missing",
    versionInstalled: version,
    rawRecords: existing.standardRecords + existing.extrasRecords,
    rawArtwork:
      existing.openmojiArtwork.standard +
      existing.openmojiArtwork.extrasOpenmoji +
      existing.openmojiArtwork.extrasUnicode,
    rawMetadata: existing.standardRecords + existing.extrasRecords,
    uniqueUnicode: existing.standardRecords,
    uniqueNonUnicode: existing.extrasRecords,
    notes: [
      `Standard: ${existing.standardRecords}`,
      `Extras: ${existing.extrasRecords}`,
      `Artwork standard/extras-openmoji/extras-unicode: ${existing.openmojiArtwork.standard}/${existing.openmojiArtwork.extrasOpenmoji}/${existing.openmojiArtwork.extrasUnicode}`,
    ],
  } satisfies Partial<MasterSourceAuditEntry>;
}

function auditEmojibase() {
  const dataVersion = getInstalledPackageVersion("emojibase-data");
  const metadataPath = join(rootDir, "src", "data", "emojibase-metadata.json");
  const metadata = existsSync(metadataPath)
    ? readJson<{ stats: { matched: number } }>(metadataPath)
    : null;

  return {
    status: dataVersion === "17.0.0" ? "installed" : dataVersion ? "available" : "missing",
    versionInstalled: dataVersion,
    rawMetadata: metadata?.stats.matched ?? null,
    notes: metadata
      ? [`Generated metadata matched ${metadata.stats.matched} standard records.`]
      : ["Run npm run emojibase:build to generate metadata snapshot."],
  } satisfies Partial<MasterSourceAuditEntry>;
}

function auditPackageSource(
  packageName: string,
  expectedVersion: string,
): Partial<MasterSourceAuditEntry> {
  const version = getInstalledPackageVersion(packageName);

  return {
    status:
      version === expectedVersion
        ? "installed"
        : version
          ? "available"
          : "pending",
    versionInstalled: version,
    notes:
      version === expectedVersion
        ? [`${packageName}@${version} installed.`]
        : [`Expected ${packageName}@${expectedVersion}, found ${version ?? "not installed"}.`],
  };
}

function auditGitSource(
  entry: MasterSourceLockEntry,
  localPath?: string,
): Partial<MasterSourceAuditEntry> {
  const notes: string[] = [`Locked commit: ${entry.commit ?? "pending"}`];

  if (localPath && existsSync(localPath)) {
    notes.push(`Local cache present: ${localPath}`);
    return {
      status: "available",
      versionInstalled: entry.version,
      commitOrChecksum: entry.commit ?? null,
      notes,
    };
  }

  return {
    status: "pending",
    versionInstalled: null,
    commitOrChecksum: entry.commit ?? null,
    notes: [...notes, "Awaiting 8.2 raw source ingestion."],
  };
}

function buildAuditEntry(
  entry: MasterSourceLockEntry,
  existing: ReturnType<typeof getExistingProjectCounts>,
): MasterSourceAuditEntry {
  let details: Partial<MasterSourceAuditEntry> = {
    status: "pending",
    versionInstalled: null,
    rawRecords: null,
    rawArtwork: null,
    rawMetadata: null,
    uniqueUnicode: null,
    uniqueNonUnicode: null,
    duplicates: null,
    merged: null,
    newRecords: null,
    unmatched: null,
    commitOrChecksum: entry.commit ?? entry.checksum ?? null,
    notes: [],
  };

  switch (entry.id) {
    case "openmoji":
      details = auditOpenMoji(existing);
      break;
    case "unicode-emoji-data":
      details = auditLocalUnicodeSource();
      break;
    case "unicode":
      details = auditLocalUnicodeSource();
      details.notes = [
        ...(details.notes ?? []),
        "Unicode TR51 identity rules apply in 8.3.",
      ];
      break;
    case "emojibase":
      details = auditEmojibase();
      break;
    case "emojilib":
      details = auditPackageSource("emojilib", entry.version);
      break;
    case "emoji-time":
      details = auditPackageSource("emoji-time", entry.version);
      details.notes = [
        ...(details.notes ?? []),
        "Utility source: clock/time mapping preserved separately.",
      ];
      break;
    case "twemoji":
      details = auditPackageSource("@twemoji/api", entry.version);
      details.commitOrChecksum = entry.commit ?? null;
      break;
    case "noto":
      details = auditGitSource(
        entry,
        join(rootDir, "data", "vendor", "noto-emoji"),
      );
      break;
    case "fluent":
      details = auditGitSource(
        entry,
        join(rootDir, "data", "vendor", "fluentui-emoji"),
      );
      break;
    case "emojinet":
      details = auditGitSource(
        entry,
        join(rootDir, "data", "vendor", "emojinet"),
      );
      details.notes = [
        ...(details.notes ?? []),
        "EmojiNet dataset commit to be locked during 8.2 ingestion.",
      ];
      break;
    default:
      break;
  }

  return {
    source: entry.id,
    status: details.status ?? "pending",
    versionExpected: entry.version,
    versionInstalled: details.versionInstalled ?? null,
    rawRecords: details.rawRecords ?? null,
    rawArtwork: details.rawArtwork ?? null,
    rawMetadata: details.rawMetadata ?? null,
    uniqueUnicode: details.uniqueUnicode ?? null,
    uniqueNonUnicode: details.uniqueNonUnicode ?? null,
    duplicates: details.duplicates ?? null,
    merged: details.merged ?? null,
    newRecords: details.newRecords ?? null,
    unmatched: details.unmatched ?? null,
    license: entry.license,
    commitOrChecksum: details.commitOrChecksum ?? entry.commit ?? entry.checksum ?? null,
    notes: details.notes ?? [],
  };
}

export function runSourceAudit(): MasterAuditReport {
  const lock = readJson<MasterSourceLockFile>(lockPath);
  const existing = getExistingProjectCounts();

  const report: MasterAuditReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.1",
    lockFile: "src/data/master-source-lock.json",
    existingProject: existing,
    sources: lock.sources.map((entry) => buildAuditEntry(entry, existing)),
  };

  mkdirSync(sourcesDir, { recursive: true });
  writeFileSync(auditPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}

export function verifySourceLock(): void {
  const lock = readJson<MasterSourceLockFile>(lockPath);
  const failures: string[] = [];

  for (const source of lock.sources) {
    if (source.package) {
      const installed = getInstalledPackageVersion(source.package);
      if (installed && installed !== source.version) {
        failures.push(
          `${source.id}: expected ${source.package}@${source.version}, found ${installed}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Master source lock verification failed:\n${failures.join("\n")}`);
  }
}

export function hashFile(path: string): string {
  const content = readFileSync(path);
  return createHash("sha256").update(content).digest("hex");
}

export function getLockEntry(sourceId: MasterSourceId): MasterSourceLockEntry {
  const lock = readJson<MasterSourceLockFile>(lockPath);
  const entry = lock.sources.find((source) => source.id === sourceId);

  if (!entry) {
    throw new Error(`Unknown master source: ${sourceId}`);
  }

  return entry;
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/master/audit-sources.ts");

if (isDirectRun) {
  const report = runSourceAudit();

  console.log("Phase 8.1 — Source Audit & Version Lock");
  console.log(`Lock file: ${lockPath}`);
  console.log(`Audit report: ${auditPath}`);
  console.log("");
  console.log("Existing EmojiFind data:");
  console.log(`  Standard records: ${report.existingProject.standardRecords}`);
  console.log(`  Extras records:   ${report.existingProject.extrasRecords}`);
  console.log(`  Searchable items: ${report.existingProject.searchableItems}`);
  console.log("");
  console.log("Source status:");

  for (const source of report.sources) {
    console.log(
      `  ${source.source.padEnd(20)} ${source.status.padEnd(10)} expected=${source.versionExpected} installed=${source.versionInstalled ?? "—"}`,
    );
  }

  const pending = report.sources.filter((source) => source.status !== "installed");
  console.log("");
  console.log(`Installed: ${report.sources.length - pending.length}/${report.sources.length}`);
  console.log(`Pending ingestion (8.2+): ${pending.map((source) => source.source).join(", ")}`);
}
