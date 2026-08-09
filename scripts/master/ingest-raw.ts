import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { flattenEmojiData } from "emojibase";
import type { Emoji, ShortcodesDataset } from "emojibase";
import emojibaseData from "emojibase-data/en/data.json";
import emojibaseMessages from "emojibase-data/en/messages.json";
import emojibaseCldrShortcodes from "emojibase-data/en/shortcodes/cldr.json";
import emojibaseGithubShortcodes from "emojibase-data/en/shortcodes/github.json";
import emojibaseIamcalShortcodes from "emojibase-data/en/shortcodes/iamcal.json";
import emojibaseShortcodes from "emojibase-data/en/shortcodes/emojibase.json";
import emojibaseGroups from "emojibase-data/meta/groups.json";
import emojibaseHexcodes from "emojibase-data/meta/hexcodes.json";
import type {
  MasterSourceLockFile,
  RawArtworkRecord,
  RawMetadataRecord,
  RawSourceRecord,
  SourceIngestionResult,
} from "./ingest/types";
import {
  artworkDir,
  copyTreeFiles,
  downloadFile,
  downloadKaggleDataset,
  ensureDir,
  extractZip,
  findSingleChildDir,
  getLockEntry,
  hexcodeToEmoji,
  isPrivateUseHexcode,
  masterDir,
  npmPackExtract,
  parseEmojinetUnicode,
  parseCsvLine,
  parseEmojiTestLines,
  parseUnicodeDataLines,
  rawDir,
  readJson,
  relativeToRaw,
  resolveArchiveUrl,
  rootDir,
  sha256File,
  toCodepointsFromHexcode,
  vendorDir,
  writeJson,
} from "./ingest/utils";

interface IngestionBundle {
  sourceRecords: RawSourceRecord[];
  artworkRecords: RawArtworkRecord[];
  metadataRecords: RawMetadataRecord[];
  result: SourceIngestionResult;
}

function emptyResult(source: string): SourceIngestionResult {
  return {
    source,
    success: false,
    rawRecordCount: 0,
    rawArtworkCount: 0,
    rawMetadataCount: 0,
    rawSemanticCount: 0,
    unmatchedCount: 0,
    nonUnicodeRecordCount: 0,
    warnings: [],
    errors: [],
    stagingPaths: [],
  };
}

function ingestOpenMoji(lock: MasterSourceLockFile): IngestionBundle {
  const entry = getLockEntry(lock, "openmoji");
  const result = emptyResult("openmoji");
  const sourceRecords: RawSourceRecord[] = [];
  const artworkRecords: RawArtworkRecord[] = [];
  const metadataRecords: RawMetadataRecord[] = [];

  const packageDataDir = join(rootDir, "node_modules", "openmoji", "data");
  const packageSvgDir = join(rootDir, "node_modules", "openmoji", "color", "svg");
  const stagingDataDir = join(rawDir, "openmoji", "data");
  const stagingArtworkDir = join(artworkDir, "openmoji");

  ensureDir(stagingDataDir);
  ensureDir(stagingArtworkDir);

  const openmojiJson = readJson<
    Array<Record<string, unknown> & { hexcode: string; emoji?: string; annotation?: string }>
  >(join(packageDataDir, "openmoji.json"));

  for (const [index, record] of openmojiJson.entries()) {
    const hexcode = String(record.hexcode).toUpperCase();
    const codepoints = toCodepointsFromHexcode(hexcode);
    const sourceId = `openmoji:${hexcode}`;
    const rawName = String(record.annotation ?? record.name ?? record.tags ?? sourceId);

    sourceRecords.push({
      source: "openmoji",
      sourceVersion: entry.version,
      sourceId,
      rawName,
      rawEmoji: String(record.emoji ?? hexcodeToEmoji(hexcode) ?? ""),
      rawCodepoints: codepoints,
      rawSequence: hexcode,
      rawArtworkReference: `artwork/openmoji/${hexcode}.svg`,
      rawMetadata: record,
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: isPrivateUseHexcode(hexcode) ? "emoji" : "emoji",
    });

    metadataRecords.push({
      source: "openmoji",
      sourceVersion: entry.version,
      sourceId,
      rawName,
      rawEmoji: String(record.emoji ?? hexcodeToEmoji(hexcode) ?? ""),
      rawCodepoints: codepoints,
      rawSequence: hexcode,
      rawMetadata: record,
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "metadata",
    });
  }

  for (const csvName of ["extras-openmoji.csv", "extras-unicode.csv"]) {
    const csvPath = join(packageDataDir, csvName);
    const lines = readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
    const header = parseCsvLine(lines.shift() ?? "");

    for (const line of lines) {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(header.map((key, idx) => [key, values[idx] ?? ""]));
      const hexcode = String(row.hexcode ?? "").toUpperCase();
      if (!hexcode) {
        continue;
      }

      const sourceId = `openmoji-extra:${hexcode}`;
      sourceRecords.push({
        source: "openmoji",
        sourceVersion: entry.version,
        sourceId,
        rawName: String(row.name ?? row.annotation ?? sourceId),
        rawEmoji: hexcodeToEmoji(hexcode),
        rawCodepoints: toCodepointsFromHexcode(hexcode),
        rawSequence: hexcode,
        rawArtworkReference: `artwork/openmoji/${hexcode}.svg`,
        rawMetadata: row,
        rawLicense: entry.license,
        sourceURL: entry.sourceURL,
        recordType: "emoji",
      });
    }
  }

  writeJson(join(stagingDataDir, "openmoji.json"), openmojiJson);
  writeJson(
    join(stagingDataDir, "extras-openmoji.csv.json"),
    readFileSync(join(packageDataDir, "extras-openmoji.csv"), "utf8"),
  );
  writeJson(
    join(stagingDataDir, "extras-unicode.csv.json"),
    readFileSync(join(packageDataDir, "extras-unicode.csv"), "utf8"),
  );

  const copiedArtwork = copyTreeFiles(
    packageSvgDir,
    stagingArtworkDir,
    (filePath) => filePath.endsWith(".svg"),
  );

  for (const stagedPath of copiedArtwork) {
    const fileName = stagedPath.split(/[/\\]/).pop() ?? stagedPath;
    const hexcode = fileName.replace(/\.svg$/i, "").toUpperCase();
    artworkRecords.push({
      source: "openmoji",
      sourceVersion: entry.version,
      sourceId: `openmoji-artwork:${hexcode}`,
      stagedPath: relativeToRaw(stagedPath),
      originalPath: join("node_modules/openmoji/color/svg", fileName),
      format: "svg",
      variant: "color",
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      checksum: sha256File(stagedPath),
    });
  }

  result.nonUnicodeRecordCount = sourceRecords.filter((record) =>
    isPrivateUseHexcode(record.rawSequence),
  ).length;
  result.rawRecordCount = sourceRecords.length;
  result.rawArtworkCount = artworkRecords.length;
  result.rawMetadataCount = metadataRecords.length;
  result.stagingPaths = [relativeToRaw(stagingDataDir), relativeToRaw(stagingArtworkDir)];
  result.success = true;
  return { sourceRecords, artworkRecords, metadataRecords, result };
}

async function ingestUnicodeEmojiData(lock: MasterSourceLockFile): Promise<IngestionBundle> {
  const entry = getLockEntry(lock, "unicode-emoji-data");
  const result = emptyResult("unicode-emoji-data");
  const sourceRecords: RawSourceRecord[] = [];
  const metadataRecords: RawMetadataRecord[] = [];
  const stagingDir = join(rawDir, "unicode-emoji-data");
  ensureDir(stagingDir);

  const localFiles = [
    "emoji-test.txt",
    "emoji-sequences.txt",
    "emoji-zwj-sequences.txt",
  ] as const;

  for (const fileName of localFiles) {
    const sourcePath = join(rootDir, "data", "unicode-source", fileName);
    const destinationPath = join(stagingDir, fileName);
    const content = readFileSync(sourcePath, "utf8");
    writeFileSync(destinationPath, content, "utf8");
    writeJson(join(stagingDir, `${fileName}.meta.json`), {
      fileName,
      checksum: sha256File(sourcePath),
    });

    if (fileName === "emoji-test.txt") {
      for (const record of parseEmojiTestLines(content)) {
        const sourceId = `unicode-test:${record.hexcode}:${record.status}`;
        sourceRecords.push({
          source: "unicode-emoji-data",
          sourceVersion: entry.version,
          sourceId,
          rawName: record.comment,
          rawEmoji: hexcodeToEmoji(record.hexcode),
          rawCodepoints: record.codePoints,
          rawSequence: record.hexcode,
          rawArtworkReference: null,
          rawMetadata: record,
          rawLicense: entry.license,
          sourceURL: entry.sourceURL,
          recordType: "standard-data",
        });
      }
    } else {
      for (const record of parseEmojiTestLines(content)) {
        const sourceId = `unicode-sequence:${fileName}:${record.hexcode}`;
        sourceRecords.push({
          source: "unicode-emoji-data",
          sourceVersion: entry.version,
          sourceId,
          rawName: record.comment,
          rawEmoji: hexcodeToEmoji(record.hexcode),
          rawCodepoints: record.codePoints,
          rawSequence: record.hexcode,
          rawArtworkReference: null,
          rawMetadata: { ...record, fileName },
          rawLicense: entry.license,
          sourceURL: entry.sourceURL,
          recordType: "sequence",
        });
      }
    }
  }

  const emojiDataUrl =
    "https://www.unicode.org/Public/17.0.0/ucd/emoji/emoji-data.txt";
  const emojiDataPath = join(stagingDir, "emoji-data.txt");
  await downloadFile(emojiDataUrl, emojiDataPath);
  const emojiDataContent = readFileSync(emojiDataPath, "utf8");

  for (const record of parseUnicodeDataLines(emojiDataContent)) {
    const sourceId = `unicode-emoji-data:${record.hexcode}:${record.field}`;
    metadataRecords.push({
      source: "unicode-emoji-data",
      sourceVersion: entry.version,
      sourceId,
      rawName: record.field,
      rawEmoji: hexcodeToEmoji(record.hexcode),
      rawCodepoints: record.codePoints,
      rawSequence: record.hexcode,
      rawMetadata: record,
      rawLicense: entry.license,
      sourceURL: emojiDataUrl,
      recordType: "standard-data",
    });
  }

  result.rawRecordCount = sourceRecords.length;
  result.rawMetadataCount = metadataRecords.length;
  result.stagingPaths = [relativeToRaw(stagingDir)];
  result.success = true;
  return { sourceRecords, artworkRecords: [], metadataRecords, result };
}

function ingestUnicode(lock: MasterSourceLockFile): IngestionBundle {
  const entry = getLockEntry(lock, "unicode");
  const result = emptyResult("unicode");
  const metadataRecords: RawMetadataRecord[] = [];
  const stagingDir = join(rawDir, "unicode");
  ensureDir(stagingDir);

  const flattened = flattenEmojiData(emojibaseData as Emoji[], [
    emojibaseShortcodes as ShortcodesDataset,
    emojibaseCldrShortcodes as ShortcodesDataset,
  ]);

  for (const emoji of flattened) {
    const hexcode = emoji.hexcode.toUpperCase();
    metadataRecords.push({
      source: "unicode",
      sourceVersion: entry.version,
      sourceId: `unicode-cldr:${hexcode}`,
      rawName: emoji.label,
      rawEmoji: emoji.emoji,
      rawCodepoints: toCodepointsFromHexcode(hexcode),
      rawSequence: hexcode,
      rawMetadata: {
        label: emoji.label,
        tags: emoji.tags ?? [],
        group:
          emoji.group !== undefined
            ? emojibaseGroups.groups[
                String(emoji.group) as keyof typeof emojibaseGroups.groups
              ]
            : undefined,
        subgroup:
          emoji.subgroup !== undefined
            ? emojibaseGroups.subgroups[
                String(emoji.subgroup) as keyof typeof emojibaseGroups.subgroups
              ]
            : undefined,
        version: emoji.version,
        gender: emoji.gender,
        tone: emoji.tone,
      },
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "metadata",
    });
  }

  writeJson(join(stagingDir, "cldr-via-emojibase.json"), metadataRecords);
  result.rawMetadataCount = metadataRecords.length;
  result.rawRecordCount = metadataRecords.length;
  result.stagingPaths = [relativeToRaw(stagingDir)];
  result.warnings.push(
    "CLDR annotations ingested via emojibase-data@17.0.0 mirror; direct CLDR XML not separately vendored.",
  );
  result.success = true;
  return { sourceRecords: [], artworkRecords: [], metadataRecords, result };
}

function ingestEmojibase(lock: MasterSourceLockFile): IngestionBundle {
  const entry = getLockEntry(lock, "emojibase");
  const result = emptyResult("emojibase");
  const sourceRecords: RawSourceRecord[] = [];
  const metadataRecords: RawMetadataRecord[] = [];
  const stagingDir = join(rawDir, "emojibase");
  ensureDir(stagingDir);

  const shortcodePacks = {
    emojibase: emojibaseShortcodes,
    cldr: emojibaseCldrShortcodes,
    github: emojibaseGithubShortcodes,
    iamcal: emojibaseIamcalShortcodes,
  };

  writeJson(join(stagingDir, "en-data.json"), emojibaseData);
  writeJson(join(stagingDir, "en-messages.json"), emojibaseMessages);
  writeJson(join(stagingDir, "meta-groups.json"), emojibaseGroups);
  writeJson(join(stagingDir, "meta-hexcodes.json"), emojibaseHexcodes);
  writeJson(join(stagingDir, "shortcodes"), shortcodePacks);

  const flattened = flattenEmojiData(emojibaseData as Emoji[], [
    emojibaseShortcodes as ShortcodesDataset,
    emojibaseCldrShortcodes as ShortcodesDataset,
    emojibaseGithubShortcodes as ShortcodesDataset,
    emojibaseIamcalShortcodes as ShortcodesDataset,
  ]);

  for (const emoji of flattened) {
    const hexcode = emoji.hexcode.toUpperCase();
    const sourceId = `emojibase:${hexcode}`;
    const record = {
      source: "emojibase",
      sourceVersion: entry.version,
      sourceId,
      rawName: emoji.label,
      rawEmoji: emoji.emoji,
      rawCodepoints: toCodepointsFromHexcode(hexcode),
      rawSequence: hexcode,
      rawArtworkReference: null,
      rawMetadata: emoji as unknown as Record<string, unknown>,
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "metadata" as const,
    };
    sourceRecords.push({ ...record, recordType: "emoji" });
    metadataRecords.push(record);
  }

  result.rawRecordCount = sourceRecords.length;
  result.rawMetadataCount = metadataRecords.length;
  result.stagingPaths = [relativeToRaw(stagingDir)];
  result.success = true;
  return { sourceRecords, artworkRecords: [], metadataRecords, result };
}

function ingestEmojilib(lock: MasterSourceLockFile): IngestionBundle {
  const entry = getLockEntry(lock, "emojilib");
  const result = emptyResult("emojilib");
  const sourceRecords: RawSourceRecord[] = [];
  const metadataRecords: RawMetadataRecord[] = [];
  const stagingDir = join(rawDir, "emojilib");
  const packageDir = npmPackExtract(`emojilib@${entry.version}`, join(vendorDir, "emojilib"));
  const data = readJson<Record<string, string[]>>(join(packageDir, "dist", "emoji-en-US.json"));

  writeJson(join(stagingDir, "emoji-en-US.json"), data);

  for (const [emoji, keywords] of Object.entries(data)) {
    const codepoints = [...emoji].map((char) =>
      char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
    );
    const hexcode = codepoints.join("-");
    const sourceId = `emojilib:${hexcode}`;

    sourceRecords.push({
      source: "emojilib",
      sourceVersion: entry.version,
      sourceId,
      rawName: keywords[0] ?? sourceId,
      rawEmoji: emoji,
      rawCodepoints: codepoints,
      rawSequence: hexcode,
      rawArtworkReference: null,
      rawMetadata: { keywords },
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "metadata",
    });

    metadataRecords.push({
      source: "emojilib",
      sourceVersion: entry.version,
      sourceId,
      rawName: keywords[0] ?? null,
      rawEmoji: emoji,
      rawCodepoints: codepoints,
      rawSequence: hexcode,
      rawMetadata: { keywords },
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "metadata",
    });
  }

  result.rawRecordCount = sourceRecords.length;
  result.rawMetadataCount = metadataRecords.length;
  result.stagingPaths = [relativeToRaw(stagingDir)];
  result.success = true;
  return { sourceRecords, artworkRecords: [], metadataRecords, result };
}

function ingestEmojiTime(lock: MasterSourceLockFile): IngestionBundle {
  const entry = getLockEntry(lock, "emoji-time");
  const result = emptyResult("emoji-time");
  const sourceRecords: RawSourceRecord[] = [];
  const metadataRecords: RawMetadataRecord[] = [];
  const stagingDir = join(rawDir, "emoji-time");
  const packageDir = npmPackExtract(`emoji-time@${entry.version}`, join(vendorDir, "emoji-time"));

  const packageFiles = copyTreeFiles(packageDir, stagingDir, () => true);
  result.stagingPaths = packageFiles.map(relativeToRaw);

  const clockHexcodes = [
    "1F550", "1F551", "1F552", "1F553", "1F554", "1F555", "1F556", "1F557",
    "1F558", "1F559", "1F55A", "1F55B", "1F55C", "1F55D", "1F55E", "1F55F",
    "1F560", "1F561", "1F562", "1F563", "1F564", "1F565", "1F566", "1F567",
  ];

  for (const [index, hexcode] of clockHexcodes.entries()) {
    const hour = index % 12;
    const sourceId = `emoji-time:clock-${hour}:${Math.floor(index / 12)}`;
    const mapping = {
      hour,
      halfHour: index >= 12,
      hexcode,
      emoji: hexcodeToEmoji(hexcode),
    };

    sourceRecords.push({
      source: "emoji-time",
      sourceVersion: entry.version,
      sourceId,
      rawName: `clock mapping ${hour}:${index >= 12 ? "30" : "00"}`,
      rawEmoji: mapping.emoji,
      rawCodepoints: [hexcode],
      rawSequence: hexcode,
      rawArtworkReference: null,
      rawMetadata: mapping,
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "utility",
    });

    metadataRecords.push({
      source: "emoji-time",
      sourceVersion: entry.version,
      sourceId,
      rawName: mapping.hour.toString(),
      rawEmoji: mapping.emoji,
      rawCodepoints: [hexcode],
      rawSequence: hexcode,
      rawMetadata: mapping,
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "utility",
    });
  }

  result.rawRecordCount = sourceRecords.length;
  result.rawMetadataCount = metadataRecords.length;
  result.success = true;
  return { sourceRecords, artworkRecords: [], metadataRecords, result };
}

async function ingestGitArtworkSource(
  lock: MasterSourceLockFile,
  sourceId: "twemoji" | "noto" | "fluent",
  options?: {
    artworkExtensions?: string[];
    includeMetadataJson?: boolean;
  },
): Promise<IngestionBundle> {
  const entry = getLockEntry(lock, sourceId);
  const result = emptyResult(sourceId);
  const sourceRecords: RawSourceRecord[] = [];
  const artworkRecords: RawArtworkRecord[] = [];
  const metadataRecords: RawMetadataRecord[] = [];
  const stagingArtworkDir = join(artworkDir, sourceId);
  const stagingDataDir = join(rawDir, sourceId);
  const zipPath = join(vendorDir, sourceId, `${sourceId}-${entry.commit}.zip`);
  const extractDir = join(vendorDir, sourceId, "extracted");
  const artworkExtensions = options?.artworkExtensions ?? [".svg"];

  ensureDir(join(vendorDir, sourceId));
  ensureDir(stagingDataDir);
  if (!entry.commit) {
    result.errors.push("Missing commit in source lock.");
    return { sourceRecords, artworkRecords, metadataRecords, result };
  }

  const archiveUrl = resolveArchiveUrl(entry);
  let repoRoot: string;
  try {
    await downloadFile(archiveUrl, zipPath);
    repoRoot = extractZip(zipPath, extractDir);
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : `Failed to ingest ${sourceId} archive.`,
    );
    return { sourceRecords, artworkRecords, metadataRecords, result };
  }

  const copied = copyTreeFiles(repoRoot, stagingArtworkDir, (filePath) =>
    artworkExtensions.some((extension) => filePath.toLowerCase().endsWith(extension)),
  );

  for (const stagedPath of copied) {
    const fileName = stagedPath.split(/[/\\]/).pop() ?? stagedPath;
    const hexMatch = fileName.match(/([0-9a-f-]+)\.(svg|png)$/i);
    const hexcode = hexMatch?.[1]?.toUpperCase() ?? fileName;
    const format = fileName.toLowerCase().endsWith(".png") ? "png" : "svg";
    const sourceArtworkId = `${sourceId}-artwork:${hexcode}:${fileName}`;

    artworkRecords.push({
      source: sourceId,
      sourceVersion: entry.version,
      sourceId: sourceArtworkId,
      stagedPath: relativeToRaw(stagedPath),
      originalPath: fileName,
      format,
      variant: stagedPath.includes("3D")
        ? "3d"
        : stagedPath.includes("Flat")
          ? "flat"
          : stagedPath.includes("High Contrast")
            ? "high-contrast"
            : stagedPath.includes("Color")
              ? "color"
              : stagedPath.includes("72x72")
                ? "72x72"
                : null,
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      checksum: sha256File(stagedPath),
    });

    sourceRecords.push({
      source: sourceId,
      sourceVersion: entry.version,
      sourceId: `${sourceId}:${hexcode}:${fileName}`,
      rawName: fileName,
      rawEmoji: hexcodeToEmoji(hexcode),
      rawCodepoints: toCodepointsFromHexcode(hexcode),
      rawSequence: hexcode,
      rawArtworkReference: relativeToRaw(stagedPath),
      rawMetadata: { fileName },
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "artwork-only",
    });
  }

  if (options?.includeMetadataJson) {
    const metadataFiles = copyTreeFiles(
      repoRoot,
      stagingDataDir,
      (filePath) => filePath.endsWith("metadata.json"),
    );

    for (const stagedPath of metadataFiles) {
      const metadata = readJson<Record<string, unknown>>(stagedPath);
      const folderName =
        stagedPath.split(/[/\\]/).slice(-2, -1)[0] ?? stagedPath;
      const unicode = String(metadata.unicode ?? "");
      const codepoints = [...unicode].map((char) =>
        char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
      );
      const hexcode = codepoints.join("-");
      const sourceRecordId = `${sourceId}-metadata:${folderName}`;

      metadataRecords.push({
        source: sourceId,
        sourceVersion: entry.version,
        sourceId: sourceRecordId,
        rawName: String(metadata.cldr ?? metadata.name ?? folderName),
        rawEmoji: unicode || null,
        rawCodepoints: codepoints,
        rawSequence: hexcode || folderName,
        rawMetadata: metadata,
        rawLicense: entry.license,
        sourceURL: entry.sourceURL,
        recordType: "metadata",
      });
    }
  }

  result.rawRecordCount = sourceRecords.length;
  result.rawArtworkCount = artworkRecords.length;
  result.rawMetadataCount = metadataRecords.length;
  result.stagingPaths = [
    relativeToRaw(stagingArtworkDir),
    relativeToRaw(zipPath),
    ...(options?.includeMetadataJson ? [relativeToRaw(stagingDataDir)] : []),
  ];
  result.success = copied.length > 0;
  if (!result.success) {
    result.errors.push(`No artwork files staged for ${sourceId}.`);
  }
  return { sourceRecords, artworkRecords, metadataRecords, result };
}

async function ingestEmojiNet(lock: MasterSourceLockFile): Promise<IngestionBundle> {
  const entry = getLockEntry(lock, "emojinet");
  const resolution = readJson<{
    resolution: {
      downloadURL: string;
      checksum: string;
      license: string;
      version: string;
      sourceURL: string;
      archiveURL: string;
      provenance: string;
      recordCount: number;
      senseCount: number;
      unicodeMappings: number;
    };
  }>(join(masterDir, "..", "emojinet-source-resolution.json"));
  const resolved = resolution.resolution;
  const result = emptyResult("emojinet");
  const sourceRecords: RawSourceRecord[] = [];
  const metadataRecords: RawMetadataRecord[] = [];
  const stagingDir = join(rawDir, "emojinet");
  const vendorEmojinetDir = join(vendorDir, "emojinet");
  const zipPath = join(vendorEmojinetDir, "kaggle-emojinet-v1.zip");
  const extractDir = join(vendorEmojinetDir, "kaggle-v1-extracted");

  ensureDir(stagingDir);
  ensureDir(vendorEmojinetDir);

  try {
    await downloadKaggleDataset(resolved.downloadURL, zipPath, entry.checksum ?? resolved.checksum);
    extractZip(zipPath, extractDir);
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Failed to download or extract EmojiNet bundle.",
    );
    return { sourceRecords, artworkRecords: [], metadataRecords, result };
  }

  const extractedJsonPath = join(extractDir, "emojis.json");
  if (!existsSync(extractedJsonPath)) {
    result.errors.push("EmojiNet bundle did not contain emojis.json.");
    return { sourceRecords, artworkRecords: [], metadataRecords, result };
  }

  const stagedJsonPath = join(stagingDir, "emojis.json");
  copyFileSync(extractedJsonPath, stagedJsonPath);
  writeJson(join(stagingDir, "source-resolution.json"), resolved);

  const jsonChecksum = sha256File(stagedJsonPath);
  const emojis = readJson<
    Array<{
      category?: string;
      keywords?: string[];
      definition?: string;
      unicode?: string;
      name?: string;
      shortcode?: string | null;
      senses?: Record<string, Array<Record<string, string[]>>>;
    }>
  >(stagedJsonPath);

  let semanticCount = 0;

  for (const [index, record] of emojis.entries()) {
    const unicodeField = String(record.unicode ?? "");
    const { codepoints, sequence, emoji } = parseEmojinetUnicode(unicodeField);
    const sourceId = `emojinet:${sequence || index}`;

    sourceRecords.push({
      source: "emojinet",
      sourceVersion: entry.version,
      sourceId,
      rawName: String(record.name ?? sourceId),
      rawEmoji: emoji,
      rawCodepoints: codepoints,
      rawSequence: sequence,
      rawArtworkReference: null,
      rawMetadata: record as unknown as Record<string, unknown>,
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "emoji",
    });

    metadataRecords.push({
      source: "emojinet",
      sourceVersion: entry.version,
      sourceId: `${sourceId}:metadata`,
      rawName: String(record.name ?? null),
      rawEmoji: emoji,
      rawCodepoints: codepoints,
      rawSequence: sequence,
      rawMetadata: record as unknown as Record<string, unknown>,
      rawLicense: entry.license,
      sourceURL: entry.sourceURL,
      recordType: "metadata",
    });

    const senses = record.senses ?? {};
    for (const [partOfSpeech, senseGroups] of Object.entries(senses)) {
      if (!Array.isArray(senseGroups)) {
        continue;
      }

      for (const [groupIndex, senseGroup] of senseGroups.entries()) {
        for (const [babelNetId, definitions] of Object.entries(senseGroup)) {
          const semanticId = `${sourceId}:sense:${partOfSpeech}:${babelNetId}:${groupIndex}`;
          const semanticMetadata = {
            partOfSpeech,
            babelNetId,
            definitions,
            keywords: record.keywords ?? [],
            category: record.category ?? null,
            definition: record.definition ?? null,
            unicode: unicodeField,
            name: record.name ?? null,
            shortcode: record.shortcode ?? null,
          };

          sourceRecords.push({
            source: "emojinet",
            sourceVersion: entry.version,
            sourceId: semanticId,
            rawName: String(record.name ?? babelNetId),
            rawEmoji: emoji,
            rawCodepoints: codepoints,
            rawSequence: sequence,
            rawArtworkReference: null,
            rawMetadata: semanticMetadata,
            rawLicense: entry.license,
            sourceURL: entry.sourceURL,
            recordType: "semantic",
          });

          metadataRecords.push({
            source: "emojinet",
            sourceVersion: entry.version,
            sourceId: semanticId,
            rawName: String(record.name ?? babelNetId),
            rawEmoji: emoji,
            rawCodepoints: codepoints,
            rawSequence: sequence,
            rawMetadata: semanticMetadata,
            rawLicense: entry.license,
            sourceURL: entry.sourceURL,
            recordType: "semantic",
          });

          semanticCount += 1;
        }
      }
    }
  }

  result.rawRecordCount = sourceRecords.length;
  result.rawMetadataCount = metadataRecords.length;
  result.rawSemanticCount = semanticCount;
  result.nonUnicodeRecordCount = sourceRecords.filter((record) =>
    record.rawCodepoints.some((part) => {
      const value = Number.parseInt(part, 16);
      return value >= 0xe000 && value <= 0xf8ff;
    }),
  ).length;
  result.stagingPaths = [
    relativeToRaw(stagingDir),
    relativeToRaw(zipPath),
    relativeToRaw(stagedJsonPath),
  ];
  result.warnings.push(
    `EmojiNet ingested from verified Kaggle mirror (${entry.package}) with bundle checksum ${entry.checksum}.`,
  );
  result.warnings.push(`emojis.json checksum: ${jsonChecksum}.`);
  result.warnings.push(resolved.provenance);
  result.success = sourceRecords.length > 0;
  if (!result.success) {
    result.errors.push("EmojiNet produced zero raw records.");
  }

  return { sourceRecords, artworkRecords: [], metadataRecords, result };
}

export async function runRawIngestion(): Promise<void> {
  const lock = readJson<MasterSourceLockFile>(
    join(masterDir, "..", "master-source-lock.json"),
  );

  const bundles = [
    ingestOpenMoji(lock),
    await ingestUnicodeEmojiData(lock),
    ingestUnicode(lock),
    ingestEmojibase(lock),
    ingestEmojilib(lock),
    ingestEmojiTime(lock),
    await ingestTwemoji(lock),
    await ingestNoto(lock),
    await ingestFluent(lock),
    await ingestEmojiNet(lock),
  ];

  const sourceRecords = bundles.flatMap((bundle) => bundle.sourceRecords);
  const artworkRecords = bundles.flatMap((bundle) => bundle.artworkRecords);
  const metadataRecords = bundles.flatMap((bundle) => bundle.metadataRecords);
  const sources = bundles.map((bundle) => bundle.result);
  const failures = sources
    .filter((source) => !source.success)
    .flatMap((source) => source.errors.map((error) => `${source.source}: ${error}`));

  const report = {
    generatedAt: new Date().toISOString(),
    phase: "8.2" as const,
    lockFile: "src/data/master-source-lock.json",
    resolutionFile: "src/data/emojinet-source-resolution.json",
    reproducible: failures.length === 0,
    success: failures.length === 0,
    sources,
    totals: {
      rawRecords: sourceRecords.length,
      rawArtwork: artworkRecords.length,
      rawMetadata: metadataRecords.length,
      rawSemantic: sourceRecords.filter((record) => record.recordType === "semantic").length,
      nonUnicodeRecords: sources.reduce(
        (sum, source) => sum + source.nonUnicodeRecordCount,
        0,
      ),
    },
    previousBaseline: {
      rawRecords: 54656,
      rawArtwork: 40071,
      rawMetadata: 17212,
      nonUnicodeRecords: 734,
      note: "Prior Phase 8.2 run before EmojiNet resolution; EmojiNet previously contributed 0 records.",
    },
    failures,
  };

  writeJson(join(rawDir, "raw-source-records.json"), sourceRecords);
  writeJson(join(rawDir, "raw-artwork-records.json"), artworkRecords);
  writeJson(join(rawDir, "raw-metadata-records.json"), metadataRecords);
  writeJson(join(rawDir, "raw-ingestion-report.json"), report);

  console.log("Phase 8.2 raw ingestion complete.");
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(`Success: ${report.success}`);
  if (failures.length > 0) {
    console.error("Failures:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
}

async function ingestTwemoji(lock: MasterSourceLockFile): Promise<IngestionBundle> {
  return ingestGitArtworkSource(lock, "twemoji", {
    artworkExtensions: [".svg", ".png"],
  });
}

async function ingestNoto(lock: MasterSourceLockFile): Promise<IngestionBundle> {
  return ingestGitArtworkSource(lock, "noto", {
    artworkExtensions: [".svg", ".png"],
  });
}

async function ingestFluent(lock: MasterSourceLockFile): Promise<IngestionBundle> {
  return ingestGitArtworkSource(lock, "fluent", {
    artworkExtensions: [".svg"],
    includeMetadataJson: true,
  });
}

void runRawIngestion();
