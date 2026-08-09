/**
 * Production OpenMoji asset importer.
 *
 * Reads from the locally installed openmoji npm package (dev/build time only)
 * and copies SVGs into public/openmoji/ for runtime serving.
 *
 * Run deliberately when upgrading OpenMoji:
 *   1. Set openmoji to the target exact version in package.json
 *   2. npm install
 *   3. npm run extras:build        (regenerate extras metadata)
 *   4. npm run openmoji:import     (copy SVGs + regenerate manifests)
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_OPENMOJI_VERSION = "17.0.0";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const openmojiPackageDir = join(rootDir, "node_modules", "openmoji");
const openmojiSvgDir = join(openmojiPackageDir, "color", "svg");
const publicOpenmojiDir = join(rootDir, "public", "openmoji");

const COLLECTION_DIRS = {
  standard: join(publicOpenmojiDir, "standard"),
  "extras-openmoji": join(publicOpenmojiDir, "extras-openmoji"),
  "extras-unicode": join(publicOpenmojiDir, "extras-unicode"),
} as const;

type CollectionId = keyof typeof COLLECTION_DIRS;

const VARIATION_SELECTORS = new Set(["FE0F", "FE0E"]);

interface EmojiRef {
  hexcode: string;
  name?: string;
}

interface OpenMojiExtraRef extends EmojiRef {
  openmojiGroup: "extras-openmoji" | "extras-unicode";
}

interface ArtworkEntry {
  path: string;
  sourceHexcode: string;
  collection: CollectionId;
}

interface CollectionReport {
  imported: number;
  missing: number;
  expected: number;
  duplicates: string[];
}

function readJson<T>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(`Required file not found: ${path}`);
  }

  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function assertOpenMojiPackage(): { version: string } {
  const packageJsonPath = join(openmojiPackageDir, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new Error(
      "OpenMoji package not found. Run: npm install openmoji@17.0.0",
    );
  }

  const openmojiPackage = readJson<{ version: string }>(packageJsonPath);

  if (openmojiPackage.version !== EXPECTED_OPENMOJI_VERSION) {
    throw new Error(
      `Expected OpenMoji ${EXPECTED_OPENMOJI_VERSION}, found ${openmojiPackage.version}. ` +
        "Update package.json to the exact target version before importing.",
    );
  }

  if (!existsSync(openmojiSvgDir)) {
    throw new Error(
      `OpenMoji SVG directory not found at ${openmojiSvgDir}. ` +
        "The installed package may be incomplete.",
    );
  }

  return openmojiPackage;
}

function resolveSourceHexcode(hexcode: string): string | null {
  const candidates = [hexcode];

  const stripped = hexcode
    .split("-")
    .filter((part) => !VARIATION_SELECTORS.has(part))
    .join("-");

  if (stripped !== hexcode) {
    candidates.push(stripped);
  }

  for (const candidate of candidates) {
    const sourcePath = join(openmojiSvgDir, `${candidate}.svg`);
    if (existsSync(sourcePath)) {
      return candidate;
    }
  }

  return null;
}

function resetCollectionDir(collection: CollectionId): void {
  const dir = COLLECTION_DIRS[collection];
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
}

function importCollection(
  collection: CollectionId,
  records: EmojiRef[],
  destinationPaths: Map<string, string>,
): {
  report: CollectionReport;
  artwork: Record<string, ArtworkEntry>;
} {
  resetCollectionDir(collection);

  const artwork: Record<string, ArtworkEntry> = {};
  const report: CollectionReport = {
    imported: 0,
    missing: 0,
    expected: records.length,
    duplicates: [],
  };

  for (const record of records) {
    const sourceHexcode = resolveSourceHexcode(record.hexcode);

    if (!sourceHexcode) {
      report.missing += 1;
      continue;
    }

    const fileName = `${record.hexcode}.svg`;
    const destinationPath = join(COLLECTION_DIRS[collection], fileName);
    const publicPath = `/openmoji/${collection}/${fileName}`;
    const sourcePath = join(openmojiSvgDir, `${sourceHexcode}.svg`);

    const previousCollection = destinationPaths.get(publicPath);
    if (previousCollection) {
      report.duplicates.push(
        `${record.hexcode} (${collection} conflicts with ${previousCollection})`,
      );
      continue;
    }

    if (artwork[record.hexcode]) {
      report.duplicates.push(
        `${record.hexcode} (${collection} hexcode already imported)`,
      );
      continue;
    }

    copyFileSync(sourcePath, destinationPath);
    destinationPaths.set(publicPath, collection);
    artwork[record.hexcode] = {
      path: publicPath,
      sourceHexcode,
      collection,
    };
    report.imported += 1;
  }

  return { report, artwork };
}

function removeLegacyAssetPaths(): void {
  const legacyExtrasDir = join(rootDir, "public", "openmoji-extras");
  if (existsSync(legacyExtrasDir)) {
    rmSync(legacyExtrasDir, { recursive: true, force: true });
    console.log("Removed legacy directory: public/openmoji-extras/");
  }

  if (!existsSync(publicOpenmojiDir)) {
    return;
  }

  for (const entry of readdirSync(publicOpenmojiDir)) {
    const entryPath = join(publicOpenmojiDir, entry);
    if (statSync(entryPath).isFile() && entry.endsWith(".svg")) {
      rmSync(entryPath, { force: true });
    }
  }
}

function main(): void {
  const openmojiPackage = assertOpenMojiPackage();

  const standardEmojis = readJson<EmojiRef[]>(
    join(rootDir, "src/data/emojis.json"),
  );
  const extras = readJson<OpenMojiExtraRef[]>(
    join(rootDir, "src/data/openmoji-extras.json"),
  );

  if (standardEmojis.length === 0) {
    throw new Error("src/data/emojis.json contains no emoji records.");
  }

  if (extras.length === 0) {
    throw new Error(
      "src/data/openmoji-extras.json contains no records. Run: npm run extras:build",
    );
  }

  mkdirSync(publicOpenmojiDir, { recursive: true });

  const destinationPaths = new Map<string, string>();

  const { report: standardReport, artwork: standardArtworkEntries } =
    importCollection("standard", standardEmojis, destinationPaths);

  const standardArtwork = Object.fromEntries(
    Object.entries(standardArtworkEntries).map(([hexcode, entry]) => [
      hexcode,
      { path: entry.path, sourceHexcode: entry.sourceHexcode },
    ]),
  );

  const extrasOpenmoji = extras.filter(
    (extra) => extra.openmojiGroup === "extras-openmoji",
  );
  const extrasUnicode = extras.filter(
    (extra) => extra.openmojiGroup === "extras-unicode",
  );

  const { report: extrasOpenmojiReport, artwork: extrasOpenmojiArtwork } =
    importCollection("extras-openmoji", extrasOpenmoji, destinationPaths);
  const { report: extrasUnicodeReport, artwork: extrasUnicodeArtwork } =
    importCollection("extras-unicode", extrasUnicode, destinationPaths);

  const extrasArtwork = {
    ...extrasOpenmojiArtwork,
    ...extrasUnicodeArtwork,
  };

  if (
    standardReport.missing > 0 ||
    extrasOpenmojiReport.missing > 0 ||
    extrasUnicodeReport.missing > 0
  ) {
    console.warn("Warning: some artwork files were missing from the OpenMoji package.");
  }

  const allDuplicates = [
    ...standardReport.duplicates,
    ...extrasOpenmojiReport.duplicates,
    ...extrasUnicodeReport.duplicates,
  ];

  if (allDuplicates.length > 0) {
    throw new Error(
      `Duplicate artwork paths detected:\n${allDuplicates.join("\n")}`,
    );
  }

  const generatedAt = new Date().toISOString();

  const standardManifest = {
    generatedAt,
    openmojiVersion: openmojiPackage.version,
    format: "svg" as const,
    collection: "standard" as const,
    imported: standardReport.imported,
    missing: standardReport.missing,
    totalEmojis: standardEmojis.length,
    artwork: standardArtwork,
  };

  const extrasManifest = {
    generatedAt,
    openmojiVersion: openmojiPackage.version,
    format: "svg" as const,
    imported:
      extrasOpenmojiReport.imported + extrasUnicodeReport.imported,
    missing: extrasOpenmojiReport.missing + extrasUnicodeReport.missing,
    totalExtras: extras.length,
    collections: {
      "extras-openmoji": {
        imported: extrasOpenmojiReport.imported,
        missing: extrasOpenmojiReport.missing,
        expected: extrasOpenmoji.length,
      },
      "extras-unicode": {
        imported: extrasUnicodeReport.imported,
        missing: extrasUnicodeReport.missing,
        expected: extrasUnicode.length,
      },
    },
    artwork: Object.fromEntries(
      Object.entries(extrasArtwork).map(([hexcode, entry]) => [
        hexcode,
        {
          path: entry.path,
          sourceHexcode: entry.sourceHexcode,
          collection: entry.collection,
        },
      ]),
    ),
  };

  writeFileSync(
    join(rootDir, "src/data/openmoji-manifest.json"),
    `${JSON.stringify(standardManifest, null, 2)}\n`,
    "utf8",
  );

  writeFileSync(
    join(rootDir, "src/data/openmoji-extras-artwork-manifest.json"),
    `${JSON.stringify(extrasManifest, null, 2)}\n`,
    "utf8",
  );

  removeLegacyAssetPaths();

  console.log(`OpenMoji ${openmojiPackage.version} import complete`);
  console.log("");
  console.log("Standard Unicode emojis:");
  console.log(
    `  imported ${standardReport.imported}/${standardReport.expected} -> public/openmoji/standard/`,
  );
  console.log(`  missing ${standardReport.missing}`);
  console.log("");
  console.log("OpenMoji extras (private-use):");
  console.log(
    `  imported ${extrasOpenmojiReport.imported}/${extrasOpenmojiReport.expected} -> public/openmoji/extras-openmoji/`,
  );
  console.log(`  missing ${extrasOpenmojiReport.missing}`);
  console.log("");
  console.log("Unicode extras:");
  console.log(
    `  imported ${extrasUnicodeReport.imported}/${extrasUnicodeReport.expected} -> public/openmoji/extras-unicode/`,
  );
  console.log(`  missing ${extrasUnicodeReport.missing}`);
  console.log("");
  console.log(`Total SVG files: ${destinationPaths.size}`);
  console.log("Manifests:");
  console.log("  src/data/openmoji-manifest.json");
  console.log("  src/data/openmoji-extras-artwork-manifest.json");

  if (allDuplicates.length > 0) {
    process.exitCode = 1;
  }
}

main();
