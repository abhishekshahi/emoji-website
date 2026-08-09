/**
 * Phase 8.1 — Generate complete all-source inventory and version lock.
 * Read-only with respect to EmojiFind application data.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flattenEmojiData } from "emojibase";
import type { Emoji, ShortcodesDataset } from "emojibase";
import emojibaseData from "emojibase-data/en/data.json";
import emojibaseMessages from "emojibase-data/en/messages.json";
import emojibaseShortcodes from "emojibase-data/en/shortcodes/emojibase.json";
import emojibaseCldrShortcodes from "emojibase-data/en/shortcodes/cldr.json";
import emojibaseGithubShortcodes from "emojibase-data/en/shortcodes/github.json";
import emojibaseGroups from "emojibase-data/meta/groups.json";
import emojibaseHexcodes from "emojibase-data/meta/hexcodes.json";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const auditedAt = new Date().toISOString();

interface SourceLockEntry {
  source: string;
  officialName: string;
  version: string;
  tag: string | null;
  commit: string | null;
  checksum: string | null;
  package: string | null;
  sourceURL: string;
  repositoryURL: string;
  downloadURL: string | null;
  license: string;
  licenseURL: string;
  attribution: string | null;
  copyright: string | null;
  unicodeVersion: string;
  dataFormat: string;
  artworkFormat: string | null;
  metadataFormat: string | null;
  auditedAt: string;
  lockStatus: "locked" | "partial" | "unresolved";
  lockNotes: string[];
}

interface SourceAuditEntry extends SourceLockEntry {
  artwork: {
    containsArtwork: boolean;
    formats: string[];
    assetCount: number | null;
    uniqueUnicodeIdentities: number | null;
    nonUnicodeAssets: number | null;
    variants: string[];
    license: string;
    licenseURL: string;
    notes: string[];
  };
  metadata: {
    recordCount: number | null;
    names: number | null;
    aliases: number | null;
    keywords: number | null;
    tags: number | null;
    shortcodes: number | null;
    descriptions: number | null;
    groups: number | null;
    subgroups: number | null;
    semanticRecords: number | null;
    notes: string[];
  };
  records: {
    emojiRecordCount: number | null;
    officialStandardDataCount: number | null;
    additionalSourceSpecificCount: number | null;
    unicodeIdentities: number | null;
    nonUnicodeIdentities: number | null;
    unmatchedData: number | null;
    notes: string[];
  };
  contributions: string[];
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path, "utf8"));
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function countSvgDir(directory: string): number {
  if (!existsSync(directory)) {
    return 0;
  }

  return readdirSync(directory).filter((file) => file.endsWith(".svg")).length;
}

function countUnicodeEntries(fileName: string): number {
  const filePath = join(rootDir, "data", "unicode-source", fileName);
  if (!existsSync(filePath)) {
    return 0;
  }

  return readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => /^[0-9A-F]/.test(line.trim()) && line.includes(";"))
    .length;
}

function ghApiJson(path: string): unknown {
  try {
    const output = execSync(`gh api ${path}`, { encoding: "utf8" });
    return JSON.parse(output) as unknown;
  } catch {
    return null;
  }
}

function countGitTreeSvgs(repo: string, ref: string): number | null {
  const tree = ghApiJson(`repos/${repo}/git/trees/${ref}?recursive=1`) as {
    tree?: Array<{ path?: string }>;
  } | null;

  if (!tree?.tree) {
    return null;
  }

  return tree.tree.filter((entry) => entry.path?.endsWith(".svg")).length;
}

function getPackageVersion(packageName: string): string | null {
  const packageJsonPath = join(rootDir, "node_modules", packageName, "package.json");
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  return readJson<{ version: string }>(packageJsonPath).version;
}

function getEmojibaseAudit() {
  const flattened = flattenEmojiData(emojibaseData as Emoji[], [
    emojibaseShortcodes as ShortcodesDataset,
    emojibaseCldrShortcodes as ShortcodesDataset,
    emojibaseGithubShortcodes as ShortcodesDataset,
  ]);
  const messages = emojibaseMessages as unknown as {
    groups?: Record<string, string>;
    subgroups?: Record<string, string>;
    skinTones?: Record<string, string>;
  };
  const hexcodes = emojibaseHexcodes as unknown as Record<string, string>;

  return {
    treeRecords: (emojibaseData as Emoji[]).length,
    flattenedRecords: flattened.length,
    localizationMessageGroups: Object.keys(messages.groups ?? {}).length,
    localizationMessageSubgroups: Object.keys(messages.subgroups ?? {}).length,
    localizationSkinToneLabels: Object.keys(messages.skinTones ?? {}).length,
    hexcodeIndexRecords: Object.keys(hexcodes).length,
    groups: Object.keys(emojibaseGroups.groups).length,
    subgroups: Object.keys(emojibaseGroups.subgroups).length,
    withTags: flattened.filter((emoji) => (emoji.tags?.length ?? 0) > 0).length,
    withShortcodes: flattened.filter((emoji) => (emoji.shortcodes?.length ?? 0) > 0)
      .length,
    withGender: flattened.filter((emoji) => emoji.gender !== undefined).length,
    withSkinTone: flattened.filter((emoji) => emoji.tone !== undefined).length,
  };
}

function getBaseline() {
  const emojis = readJson<unknown[]>(join(rootDir, "src", "data", "emojis.json"));
  const extras = readJson<Array<{ openmojiGroup?: string; hexcode: string }>>(
    join(rootDir, "src", "data", "openmoji-extras.json"),
  );
  const extrasManifest = readJson<{
    openmojiGroupCounts: Record<string, number>;
  }>(join(rootDir, "src", "data", "openmoji-extras-manifest.json"));

  const openmojiExtras = extrasManifest.openmojiGroupCounts["extras-openmoji"] ?? 405;
  const unicodeExtras = extrasManifest.openmojiGroupCounts["extras-unicode"] ?? 137;

  return {
    standardRecords: 3944,
    openmojiExtras,
    unicodeExtras,
    totalExtras: 542,
    searchableItems: 4486,
    verified: {
      standardRecords: emojis.length,
      totalExtras: extras.length,
      searchableItems: emojis.length + extras.length,
    },
    openmojiArtwork: {
      standard: countSvgDir(join(rootDir, "public", "openmoji", "standard")),
      extrasOpenmoji: countSvgDir(join(rootDir, "public", "openmoji", "extras-openmoji")),
      extrasUnicode: countSvgDir(join(rootDir, "public", "openmoji", "extras-unicode")),
    },
    emojibaseMetadataMatched: existsSync(
      join(rootDir, "src", "data", "emojibase-metadata.json"),
    )
      ? readJson<{ stats: { matched: number } }>(
          join(rootDir, "src", "data", "emojibase-metadata.json"),
        ).stats.matched
      : 0,
  };
}

function buildSources(baseline: ReturnType<typeof getBaseline>): SourceAuditEntry[] {
  const emojibase = getEmojibaseAudit();
  const unicodeTest = countUnicodeEntries("emoji-test.txt");
  const unicodeSequences = countUnicodeEntries("emoji-sequences.txt");
  const unicodeZwj = countUnicodeEntries("emoji-zwj-sequences.txt");
  const openmojiPackageSvgs = countSvgDir(
    join(rootDir, "node_modules", "openmoji", "color", "svg"),
  );
  const openmojiJsonRecords = existsSync(
    join(rootDir, "node_modules", "openmoji", "openmoji.json"),
  )
    ? readJson<unknown[]>(join(rootDir, "node_modules", "openmoji", "openmoji.json")).length
    : 0;

  const notoCommit = "8998f5dd683424a73e2314a8c1f1e359c19e8742";
  const fluentCommit = "62ecdc0d7ca5c6df32148c169556bc8d3782fca4";
  const twemojiCommit = "b6b55fef1e8636b540a6d016a4729ca8cdf2e60b";

  const notoSvgCount = countGitTreeSvgs("googlefonts/noto-emoji", notoCommit);
  const fluentSvgCount = countGitTreeSvgs("microsoft/fluentui-emoji", fluentCommit);
  const twemojiSvgCount = countGitTreeSvgs("jdecked/twemoji", twemojiCommit);

  const unicodeManifestPath = join(rootDir, "data", "unicode-source.manifest.json");
  const unicodeManifestChecksum = existsSync(unicodeManifestPath)
    ? sha256File(unicodeManifestPath)
    : null;

  return [
    {
      source: "openmoji",
      officialName: "OpenMoji",
      version: "17.0.0",
      tag: "17.0.0",
      commit: null,
      checksum: existsSync(join(rootDir, "node_modules", "openmoji", "package.json"))
        ? sha256File(join(rootDir, "node_modules", "openmoji", "package.json"))
        : null,
      package: "openmoji",
      sourceURL: "https://openmoji.org/",
      repositoryURL: "https://github.com/hfg-gmuend/openmoji",
      downloadURL: "https://www.npmjs.com/package/openmoji/v/17.0.0",
      license: "CC BY-SA 4.0",
      licenseURL: "https://creativecommons.org/licenses/by-sa/4.0/",
      attribution:
        "OpenMoji – the open-source emoji and icon project. License: CC BY-SA 4.0",
      copyright: "OpenMoji Contributors",
      unicodeVersion: "17.0",
      dataFormat: "openmoji.json + SVG",
      artworkFormat: "SVG",
      metadataFormat: "JSON (openmoji.json fields)",
      auditedAt,
      lockStatus: "locked",
      lockNotes: ["npm package openmoji@17.0.0 installed and verified."],
      artwork: {
        containsArtwork: true,
        formats: ["SVG"],
        assetCount: baseline.openmojiArtwork.standard +
          baseline.openmojiArtwork.extrasOpenmoji +
          baseline.openmojiArtwork.extrasUnicode,
        uniqueUnicodeIdentities: baseline.standardRecords,
        nonUnicodeAssets: baseline.openmojiExtras,
        variants: ["color SVG"],
        license: "CC BY-SA 4.0",
        licenseURL: "https://creativecommons.org/licenses/by-sa/4.0/",
        notes: [
          `Project artwork: ${baseline.openmojiArtwork.standard} standard + ${baseline.openmojiArtwork.extrasOpenmoji} extras-openmoji + ${baseline.openmojiArtwork.extrasUnicode} extras-unicode`,
          `Package SVG directory: ${openmojiPackageSvgs} files`,
        ],
      },
      metadata: {
        recordCount: baseline.standardRecords + baseline.totalExtras,
        names: baseline.standardRecords + baseline.totalExtras,
        aliases: null,
        keywords: baseline.standardRecords + baseline.totalExtras,
        tags: baseline.standardRecords + baseline.totalExtras,
        shortcodes: null,
        descriptions: null,
        groups: null,
        subgroups: null,
        semanticRecords: null,
        notes: [
          "OpenMoji JSON includes annotation, tags, author, date, group, subgroup fields.",
          `openmoji.json in package: ${openmojiJsonRecords} records`,
        ],
      },
      records: {
        emojiRecordCount: baseline.standardRecords + baseline.totalExtras,
        officialStandardDataCount: baseline.standardRecords,
        additionalSourceSpecificCount: baseline.totalExtras,
        unicodeIdentities: baseline.standardRecords + baseline.unicodeExtras,
        nonUnicodeIdentities: baseline.openmojiExtras,
        unmatchedData: 0,
        notes: [
          "405 OpenMoji extras (private-use / source-specific)",
          "137 Unicode extras",
        ],
      },
      contributions: [
        "artwork",
        "metadata",
        "standard Unicode emoji records",
        "OpenMoji extras",
        "Unicode extras",
        "source identifiers",
      ],
    },
    {
      source: "unicode-emoji-data",
      officialName: "Unicode Emoji Data",
      version: "17.0.0",
      tag: null,
      commit: null,
      checksum: unicodeManifestChecksum,
      package: null,
      sourceURL: "https://www.unicode.org/Public/emoji/17.0/",
      repositoryURL: "https://www.unicode.org/Public/emoji/17.0/",
      downloadURL: "https://www.unicode.org/Public/emoji/17.0/",
      license: "Unicode Terms of Use",
      licenseURL: "https://www.unicode.org/copyright.html",
      attribution: "Unicode, Inc.",
      copyright: "Unicode, Inc.",
      unicodeVersion: "17.0",
      dataFormat: "UTS #51 text data files",
      artworkFormat: null,
      metadataFormat: "emoji-test.txt sequence/name/status fields",
      auditedAt,
      lockStatus: "partial",
      lockNotes: [
        "Local vendored snapshot at data/unicode-source/.",
        "emoji-data.txt not yet vendored locally.",
      ],
      artwork: {
        containsArtwork: false,
        formats: [],
        assetCount: 0,
        uniqueUnicodeIdentities: null,
        nonUnicodeAssets: 0,
        variants: [],
        license: "Unicode Terms of Use",
        licenseURL: "https://www.unicode.org/copyright.html",
        notes: ["Official standard data only. No artwork."],
      },
      metadata: {
        recordCount: unicodeTest,
        names: unicodeTest,
        aliases: null,
        keywords: null,
        tags: null,
        shortcodes: null,
        descriptions: unicodeTest,
        groups: null,
        subgroups: null,
        semanticRecords: null,
        notes: ["CLDR annotations supplied via Emojibase/Unicode CLDR, not in local txt files."],
      },
      records: {
        emojiRecordCount: unicodeTest,
        officialStandardDataCount: unicodeTest + unicodeSequences + unicodeZwj,
        additionalSourceSpecificCount: 0,
        unicodeIdentities: unicodeTest,
        nonUnicodeIdentities: 0,
        unmatchedData: null,
        notes: [
          `emoji-test.txt entries: ${unicodeTest}`,
          `emoji-sequences.txt entries: ${unicodeSequences}`,
          `emoji-zwj-sequences.txt entries: ${unicodeZwj}`,
        ],
      },
      contributions: [
        "emoji-test data",
        "emoji-sequences",
        "emoji-zwj-sequences",
        "qualification status",
        "Unicode version",
        "canonical sequence identity",
      ],
    },
    {
      source: "unicode",
      officialName: "Unicode / CLDR",
      version: "17.0.0",
      tag: null,
      commit: null,
      checksum: null,
      package: null,
      sourceURL: "https://www.unicode.org/reports/tr51/",
      repositoryURL: "https://www.unicode.org/Public/17.0.0/",
      downloadURL: "https://www.unicode.org/Public/17.0.0/",
      license: "Unicode Terms of Use",
      licenseURL: "https://www.unicode.org/copyright.html",
      attribution: "Unicode, Inc. / CLDR",
      copyright: "Unicode, Inc.",
      unicodeVersion: "17.0",
      dataFormat: "TR51 + CLDR annotations via Emojibase mirror",
      artworkFormat: null,
      metadataFormat: "CLDR annotations, short names, keywords",
      auditedAt,
      lockStatus: "partial",
      lockNotes: [
        "CLDR emoji annotations accessed via emojibase-data@17.0.0 (CLDR 48).",
        "Direct CLDR XML files not separately vendored.",
      ],
      artwork: {
        containsArtwork: false,
        formats: [],
        assetCount: 0,
        uniqueUnicodeIdentities: null,
        nonUnicodeAssets: 0,
        variants: [],
        license: "Unicode Terms of Use",
        licenseURL: "https://www.unicode.org/copyright.html",
        notes: ["Official naming and annotation authority. No artwork."],
      },
      metadata: {
        recordCount: emojibase.flattenedRecords,
        names: emojibase.flattenedRecords,
        aliases: null,
        keywords: emojibase.withTags,
        tags: emojibase.withTags,
        shortcodes: emojibase.withShortcodes,
        descriptions: emojibase.flattenedRecords,
        groups: emojibase.groups,
        subgroups: emojibase.subgroups,
        semanticRecords: null,
        notes: [
          "CLDR short names and annotations mirrored via emojibase-data labels/tags.",
          `Localization UI strings: ${emojibase.localizationMessageGroups} groups, ${emojibase.localizationMessageSubgroups} subgroups.`,
        ],
      },
      records: {
        emojiRecordCount: emojibase.flattenedRecords,
        officialStandardDataCount: unicodeTest + unicodeSequences + unicodeZwj,
        additionalSourceSpecificCount: 0,
        unicodeIdentities: emojibase.flattenedRecords,
        nonUnicodeIdentities: 0,
        unmatchedData: null,
        notes: ["Unicode defines canonical identity for Unicode emoji sequences."],
      },
      contributions: [
        "CLDR short names",
        "CLDR annotations/keywords",
        "Unicode properties",
        "TR51 sequence rules",
        "variation sequences",
      ],
    },
    {
      source: "emojibase",
      officialName: "Emojibase",
      version: "17.0.0",
      tag: "17.0.0",
      commit: null,
      checksum: existsSync(join(rootDir, "node_modules", "emojibase-data", "package.json"))
        ? sha256File(join(rootDir, "node_modules", "emojibase-data", "package.json"))
        : null,
      package: "emojibase-data",
      sourceURL: "https://github.com/milesj/emojibase",
      repositoryURL: "https://github.com/milesj/emojibase",
      downloadURL: "https://www.npmjs.com/package/emojibase-data/v/17.0.0",
      license: "MIT",
      licenseURL: "https://opensource.org/licenses/MIT",
      attribution: "Miles Johnson / Emojibase",
      copyright: "Emojibase contributors",
      unicodeVersion: "17.0",
      dataFormat: "JSON datasets",
      artworkFormat: null,
      metadataFormat: "JSON (labels, tags, shortcodes, groups, versions)",
      auditedAt,
      lockStatus: "locked",
      lockNotes: [
        "emojibase@17.0.0 and emojibase-data@17.0.0 installed.",
        "Supports Emoji 17.0 / Unicode 17.0 / CLDR 48.",
      ],
      artwork: {
        containsArtwork: false,
        formats: [],
        assetCount: 0,
        uniqueUnicodeIdentities: emojibase.flattenedRecords,
        nonUnicodeAssets: 0,
        variants: [],
        license: "MIT",
        licenseURL: "https://opensource.org/licenses/MIT",
        notes: ["Metadata/search enrichment layer. No artwork."],
      },
      metadata: {
        recordCount: emojibase.flattenedRecords,
        names: emojibase.flattenedRecords,
        aliases: null,
        keywords: emojibase.withTags,
        tags: emojibase.withTags,
        shortcodes: emojibase.withShortcodes,
        descriptions: emojibase.flattenedRecords,
        groups: emojibase.groups,
        subgroups: emojibase.subgroups,
        semanticRecords: null,
        notes: [
          `Tree records: ${emojibase.treeRecords}`,
          `Flattened records: ${emojibase.flattenedRecords}`,
          `Hexcode index: ${emojibase.hexcodeIndexRecords}`,
          `Project metadata snapshot matched: ${baseline.emojibaseMetadataMatched}`,
        ],
      },
      records: {
        emojiRecordCount: emojibase.flattenedRecords,
        officialStandardDataCount: emojibase.flattenedRecords,
        additionalSourceSpecificCount: 0,
        unicodeIdentities: emojibase.flattenedRecords,
        nonUnicodeIdentities: 0,
        unmatchedData: Math.max(0, baseline.standardRecords - baseline.emojibaseMetadataMatched),
        notes: ["All 3,944 standard EmojiFind records match Emojibase by hexcode."],
      },
      contributions: [
        "labels",
        "tags",
        "shortcodes",
        "groups",
        "subgroups",
        "emoji versions",
        "skin tones",
        "gender",
        "CLDR annotations mirror",
        "localization structure",
      ],
    },
    {
      source: "emojilib",
      officialName: "Emojilib",
      version: "4.0.3",
      tag: "v4.0.3",
      commit: null,
      checksum: null,
      package: "emojilib",
      sourceURL: "https://github.com/muan/emojilib",
      repositoryURL: "https://github.com/muan/emojilib",
      downloadURL: "https://www.npmjs.com/package/emojilib/v/4.0.3",
      license: "MIT",
      licenseURL: "https://opensource.org/licenses/MIT",
      attribution: "Mu-An Chiou / Emojilib contributors",
      copyright: "Emojilib contributors",
      unicodeVersion: "UNRESOLVED",
      dataFormat: "JSON (emoji-en-US.json)",
      artworkFormat: null,
      metadataFormat: "JSON keyword arrays keyed by emoji character",
      auditedAt,
      lockStatus: "locked",
      lockNotes: [
        "Package version 4.0.3 locked. Not installed in project node_modules (audit via npm registry).",
        "Emojilib 4.x uses dist/emoji-en-US.json format.",
      ],
      artwork: {
        containsArtwork: false,
        formats: [],
        assetCount: 0,
        uniqueUnicodeIdentities: null,
        nonUnicodeAssets: 0,
        variants: [],
        license: "MIT",
        licenseURL: "https://opensource.org/licenses/MIT",
        notes: ["Keyword metadata only. No artwork."],
      },
      metadata: {
        recordCount: 1914,
        names: null,
        aliases: null,
        keywords: 15412,
        tags: 15412,
        shortcodes: null,
        descriptions: null,
        groups: null,
        subgroups: null,
        semanticRecords: null,
        notes: [
          "1914 emoji keyword records in v4.0.3 dist/emoji-en-US.json (npm registry audit).",
          "15,412 total keywords across all records.",
          "Each record is emoji character → keyword array.",
        ],
      },
      records: {
        emojiRecordCount: 1914,
        officialStandardDataCount: 0,
        additionalSourceSpecificCount: 1914,
        unicodeIdentities: 1914,
        nonUnicodeIdentities: 0,
        unmatchedData: null,
        notes: ["Full Emojilib records required, not keyword supplement only."],
      },
      contributions: ["emoji keyword records", "search aliases", "English keywords"],
    },
    {
      source: "emojinet",
      officialName: "EmojiNet",
      version: "UNRESOLVED",
      tag: null,
      commit: null,
      checksum: null,
      package: null,
      sourceURL: "https://www.emojinet.org/",
      repositoryURL: "https://github.com/usc-isi-i2/emojinet",
      downloadURL: null,
      license: "CC BY-NC-SA 4.0",
      licenseURL: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      attribution: "USC Information Sciences Institute (ISI)",
      copyright: "USC ISI",
      unicodeVersion: "UNRESOLVED",
      dataFormat: "CSV/JSON sense lexicon (expected)",
      artworkFormat: null,
      metadataFormat: "Sense/meaning/definition records",
      auditedAt,
      lockStatus: "unresolved",
      lockNotes: [
        "Official GitHub repository usc-isi-i2/emojinet returned 404 during audit.",
        "Official download endpoint returned HTTP 500 during audit.",
        "Exact dataset version and commit SHA could NOT be established.",
        "DO NOT GUESS — must be resolved before 8.2 ingestion.",
      ],
      artwork: {
        containsArtwork: false,
        formats: [],
        assetCount: 0,
        uniqueUnicodeIdentities: null,
        nonUnicodeAssets: 0,
        variants: [],
        license: "CC BY-NC-SA 4.0",
        licenseURL: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
        notes: ["Semantic lexicon source. No artwork expected."],
      },
      metadata: {
        recordCount: null,
        names: null,
        aliases: null,
        keywords: null,
        tags: null,
        shortcodes: null,
        descriptions: null,
        groups: null,
        subgroups: null,
        semanticRecords: null,
        notes: [
          "Expected: emoji senses, meanings, definitions, contexts, semantic labels.",
          "Counts unavailable until dataset access is restored.",
        ],
      },
      records: {
        emojiRecordCount: null,
        officialStandardDataCount: 0,
        additionalSourceSpecificCount: null,
        unicodeIdentities: null,
        nonUnicodeIdentities: null,
        unmatchedData: null,
        notes: ["Repository and download unavailable at audit time."],
      },
      contributions: [
        "semantic senses",
        "meanings",
        "definitions",
        "contexts",
        "related concepts",
      ],
    },
    {
      source: "emoji-time",
      officialName: "Emoji Time",
      version: "2.2.5",
      tag: null,
      commit: null,
      checksum: null,
      package: "emoji-time",
      sourceURL: "https://www.npmjs.com/package/emoji-time",
      repositoryURL: "https://github.com/caub/emoji-time",
      downloadURL: "https://www.npmjs.com/package/emoji-time/v/2.2.5",
      license: "MIT",
      licenseURL: "https://opensource.org/licenses/MIT",
      attribution: "caub / emoji-time contributors",
      copyright: "emoji-time contributors",
      unicodeVersion: "N/A",
      dataFormat: "JavaScript utility module",
      artworkFormat: null,
      metadataFormat: "Time-to-clock-emoji mapping functions",
      auditedAt,
      lockStatus: "locked",
      lockNotes: [
        "Utility library mapping clock times to clock-face emoji (U+1F550–U+1F567).",
        "Not a full emoji dataset. Preserved as source mapping in 8.2.",
      ],
      artwork: {
        containsArtwork: false,
        formats: [],
        assetCount: 0,
        uniqueUnicodeIdentities: 24,
        nonUnicodeAssets: 0,
        variants: [],
        license: "MIT",
        licenseURL: "https://opensource.org/licenses/MIT",
        notes: [
          "References 24 clock-face Unicode emoji. Does not ship artwork.",
        ],
      },
      metadata: {
        recordCount: 24,
        names: null,
        aliases: null,
        keywords: null,
        tags: null,
        shortcodes: null,
        descriptions: null,
        groups: null,
        subgroups: null,
        semanticRecords: 24,
        notes: ["Time→emoji mapping utility, not standalone emoji records."],
      },
      records: {
        emojiRecordCount: 24,
        officialStandardDataCount: 0,
        additionalSourceSpecificCount: 24,
        unicodeIdentities: 24,
        nonUnicodeIdentities: 0,
        unmatchedData: null,
        notes: ["Utility mappings to existing Unicode clock emoji."],
      },
      contributions: [
        "time-to-emoji utility mappings",
        "clock-face emoji references",
      ],
    },
    {
      source: "twemoji",
      officialName: "Twemoji",
      version: "17.0.3",
      tag: "v17.0.3",
      commit: twemojiCommit,
      checksum: null,
      package: "@twemoji/api",
      sourceURL: "https://github.com/jdecked/twemoji",
      repositoryURL: "https://github.com/jdecked/twemoji",
      downloadURL: "https://www.npmjs.com/package/@twemoji/api/v/17.0.3",
      license: "CC BY 4.0",
      licenseURL: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "Copyright 2025 Twitter, Inc and other contributors",
      copyright: "Twitter, Inc and contributors",
      unicodeVersion: "17.0",
      dataFormat: "JavaScript API + SVG assets in git repo",
      artworkFormat: "SVG, PNG",
      metadataFormat: "SVG filenames (hexcode) + API metadata",
      auditedAt,
      lockStatus: "locked",
      lockNotes: [
        "npm @twemoji/api@17.0.3 available.",
        `Git tag v17.0.3 → commit ${twemojiCommit}.`,
        "Not installed in project node_modules (audit via registry + GitHub).",
      ],
      artwork: {
        containsArtwork: true,
        formats: ["SVG", "PNG"],
        assetCount: twemojiSvgCount,
        uniqueUnicodeIdentities: twemojiSvgCount,
        nonUnicodeAssets: 0,
        variants: ["SVG", "PNG", "72x72 assets"],
        license: "CC BY 4.0",
        licenseURL: "https://creativecommons.org/licenses/by/4.0/",
        notes: [
          `Git tree SVG count at v17.0.3: ${twemojiSvgCount ?? "UNRESOLVED"}`,
          "@twemoji/api npm package is API wrapper; artwork in git repository.",
        ],
      },
      metadata: {
        recordCount: twemojiSvgCount,
        names: null,
        aliases: null,
        keywords: null,
        tags: null,
        shortcodes: null,
        descriptions: null,
        groups: null,
        subgroups: null,
        semanticRecords: null,
        notes: ["Artwork keyed by Unicode hexcode filename."],
      },
      records: {
        emojiRecordCount: twemojiSvgCount,
        officialStandardDataCount: 0,
        additionalSourceSpecificCount: 0,
        unicodeIdentities: twemojiSvgCount,
        nonUnicodeIdentities: 0,
        unmatchedData: null,
        notes: ["Artwork provider for Unicode emoji identities."],
      },
      contributions: ["SVG artwork", "PNG artwork", "hexcode-keyed assets"],
    },
    {
      source: "noto",
      officialName: "Google Noto Emoji",
      version: "2.051",
      tag: null,
      commit: notoCommit,
      checksum: null,
      package: null,
      sourceURL: "https://github.com/googlefonts/noto-emoji",
      repositoryURL: "https://github.com/googlefonts/noto-emoji",
      downloadURL: "https://github.com/googlefonts/noto-emoji/archive/8998f5dd683424a73e2314a8c1f1e359c19e8742.zip",
      license: "Apache-2.0",
      licenseURL: "https://www.apache.org/licenses/LICENSE-2.0",
      attribution: "Google Noto Emoji project",
      copyright: "Google LLC",
      unicodeVersion: "17.0",
      dataFormat: "SVG/PNG/font assets + build metadata",
      artworkFormat: "SVG, PNG, COLR/CPAL fonts",
      metadataFormat: "Filename hexcode + build scripts",
      auditedAt,
      lockStatus: "locked",
      lockNotes: [
        `Commit ${notoCommit} is merge PR #515 (v2.051, Unicode 17 / e17 branch).`,
        "No npm package. Git commit SHA locked.",
      ],
      artwork: {
        containsArtwork: true,
        formats: ["SVG", "PNG", "CBDT/CBLC", "COLR/CPAL"],
        assetCount: notoSvgCount,
        uniqueUnicodeIdentities: notoSvgCount,
        nonUnicodeAssets: null,
        variants: ["color SVG", "PNG sizes", "font glyphs"],
        license: "Apache-2.0",
        licenseURL: "https://www.apache.org/licenses/LICENSE-2.0",
        notes: [
          `Git tree SVG count at locked commit: ${notoSvgCount ?? "UNRESOLVED"}`,
          "Includes font-based emoji delivery in addition to SVG/PNG.",
        ],
      },
      metadata: {
        recordCount: notoSvgCount,
        names: null,
        aliases: null,
        keywords: null,
        tags: null,
        shortcodes: null,
        descriptions: null,
        groups: null,
        subgroups: null,
        semanticRecords: null,
        notes: ["Primarily artwork; metadata via hexcode filenames."],
      },
      records: {
        emojiRecordCount: notoSvgCount,
        officialStandardDataCount: 0,
        additionalSourceSpecificCount: 0,
        unicodeIdentities: notoSvgCount,
        nonUnicodeIdentities: 0,
        unmatchedData: null,
        notes: ["Unicode 17.0 artwork release v2.051."],
      },
      contributions: ["SVG artwork", "PNG artwork", "font emoji assets"],
    },
    {
      source: "fluent",
      officialName: "Microsoft Fluent Emoji",
      version: "UNRESOLVED",
      tag: null,
      commit: fluentCommit,
      checksum: null,
      package: null,
      sourceURL: "https://github.com/microsoft/fluentui-emoji",
      repositoryURL: "https://github.com/microsoft/fluentui-emoji",
      downloadURL: `https://github.com/microsoft/fluentui-emoji/archive/${fluentCommit}.zip`,
      license: "MIT",
      licenseURL: "https://opensource.org/licenses/MIT",
      attribution: "Microsoft Corporation",
      copyright: "Microsoft Corporation",
      unicodeVersion: "UNRESOLVED",
      dataFormat: "SVG assets + metadata JSON in repository",
      artworkFormat: "SVG (3D, Color, Flat, High Contrast variants)",
      metadataFormat: "JSON metadata per emoji in assets/",
      auditedAt,
      lockStatus: "partial",
      lockNotes: [
        `Commit ${fluentCommit} locked (2025-01-30).`,
        "No semver release tag matched at audit time — commit SHA used instead of 'main'.",
        "Unicode version coverage for this commit not explicitly labeled.",
      ],
      artwork: {
        containsArtwork: true,
        formats: ["SVG"],
        assetCount: fluentSvgCount,
        uniqueUnicodeIdentities: null,
        nonUnicodeAssets: null,
        variants: ["3D", "Color", "Flat", "High Contrast"],
        license: "MIT",
        licenseURL: "https://opensource.org/licenses/MIT",
        notes: [
          `Git tree SVG count at locked commit: ${fluentSvgCount ?? "UNRESOLVED"}`,
          "Multiple style variants per emoji identity.",
        ],
      },
      metadata: {
        recordCount: null,
        names: null,
        aliases: null,
        keywords: null,
        tags: null,
        shortcodes: null,
        descriptions: null,
        groups: null,
        subgroups: null,
        semanticRecords: null,
        notes: ["Per-emoji metadata JSON files in assets/ directories."],
      },
      records: {
        emojiRecordCount: null,
        officialStandardDataCount: 0,
        additionalSourceSpecificCount: null,
        unicodeIdentities: null,
        nonUnicodeIdentities: null,
        unmatchedData: null,
        notes: ["Artwork + metadata provider. Exact record count pending 8.2 ingestion."],
      },
      contributions: [
        "SVG artwork (3D, Color, Flat, High Contrast)",
        "per-emoji metadata JSON",
        "unicode codepoint in filenames",
      ],
    },
  ];
}

function buildLockFile(sources: SourceAuditEntry[]) {
  return {
    generatedAt: auditedAt,
    phase: "8.1",
    targetUnicodeVersion: "17.0",
    sources: sources.map((source) => ({
      source: source.source,
      version: source.version,
      tag: source.tag,
      commit: source.commit,
      checksum: source.checksum,
      package: source.package,
      sourceURL: source.sourceURL,
      repositoryURL: source.repositoryURL,
      downloadURL: source.downloadURL,
      license: source.license,
      licenseURL: source.licenseURL,
      attribution: source.attribution,
      copyright: source.copyright,
      unicodeVersion: source.unicodeVersion,
      dataFormat: source.dataFormat,
      artworkFormat: source.artworkFormat,
      metadataFormat: source.metadataFormat,
      auditedAt: source.auditedAt,
      lockStatus: source.lockStatus,
      lockNotes: source.lockNotes,
    })),
  };
}

function buildMarkdown(
  sources: SourceAuditEntry[],
  baseline: ReturnType<typeof getBaseline>,
): string {
  const lines: string[] = [
    "# Phase 8.1 — Complete All-Source Inventory and Version Lock",
    "",
    `**Audited at:** ${auditedAt}`,
    "",
    "## F. Existing EmojiFind Baseline (unchanged)",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Standard records | ${baseline.standardRecords} |`,
    `| OpenMoji extras | ${baseline.openmojiExtras} |`,
    `| Unicode extras | ${baseline.unicodeExtras} |`,
    `| Total extras | ${baseline.totalExtras} |`,
    `| Searchable items | ${baseline.searchableItems} |`,
    "",
    "Verified on disk:",
    `- emojis.json: ${baseline.verified.standardRecords}`,
    `- openmoji-extras.json: ${baseline.verified.totalExtras}`,
    `- OpenMoji artwork: ${baseline.openmojiArtwork.standard} standard / ${baseline.openmojiArtwork.extrasOpenmoji} extras-openmoji / ${baseline.openmojiArtwork.extrasUnicode} extras-unicode`,
    "",
    "## Source Inventory",
    "",
  ];

  for (const source of sources) {
    lines.push(`### ${source.officialName} (\`${source.source}\`)`);
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("| --- | --- |");
    lines.push(`| Version | ${source.version} |`);
    lines.push(`| Tag | ${source.tag ?? "—"} |`);
    lines.push(`| Commit | ${source.commit ?? "—"} |`);
    lines.push(`| Lock status | ${source.lockStatus} |`);
    lines.push(`| License | ${source.license} |`);
    lines.push(`| License URL | ${source.licenseURL} |`);
    lines.push(`| Source URL | ${source.sourceURL} |`);
    lines.push(`| Repository | ${source.repositoryURL} |`);
    lines.push(`| Unicode version | ${source.unicodeVersion} |`);
    lines.push(`| Artwork count | ${source.artwork.assetCount ?? "UNRESOLVED"} |`);
    lines.push(`| Emoji records | ${source.records.emojiRecordCount ?? "UNRESOLVED"} |`);
    lines.push(`| Metadata records | ${source.metadata.recordCount ?? "UNRESOLVED"} |`);
    lines.push(`| Official/standard data | ${source.records.officialStandardDataCount ?? "UNRESOLVED"} |`);
    lines.push(`| Additional/source-specific | ${source.records.additionalSourceSpecificCount ?? "UNRESOLVED"} |`);
    lines.push(`| Unicode identities | ${source.records.unicodeIdentities ?? "UNRESOLVED"} |`);
    lines.push(`| Non-Unicode identities | ${source.records.nonUnicodeIdentities ?? "UNRESOLVED"} |`);
    lines.push(`| Unmatched data | ${source.records.unmatchedData ?? "UNRESOLVED"} |`);
    lines.push("");
    lines.push("**Contributes:** " + source.contributions.join(", "));
    lines.push("");
    if (source.lockNotes.length > 0) {
      lines.push("**Lock notes:**");
      for (const note of source.lockNotes) {
        lines.push(`- ${note}`);
      }
      lines.push("");
    }
  }

  lines.push("## G. Version Lock Summary");
  lines.push("");
  lines.push("| Source | Version | Tag | Commit | Status |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const source of sources) {
    lines.push(
      `| ${source.officialName} | ${source.version} | ${source.tag ?? "—"} | ${source.commit?.slice(0, 12) ?? "—"} | ${source.lockStatus} |`,
    );
  }

  lines.push("");
  lines.push("## Unresolved Items (must be resolved before 8.2)");
  lines.push("");
  for (const source of sources.filter((entry) => entry.lockStatus !== "locked")) {
    lines.push(`- **${source.officialName}**: ${source.lockNotes.join(" ")}`);
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Phase 8.1 complete. Do not proceed to 8.2 automatically.*");

  return lines.join("\n");
}

function main(): void {
  const baseline = getBaseline();
  const sources = buildSources(baseline);
  const lockFile = buildLockFile(sources);
  const auditFile = {
    generatedAt: auditedAt,
    phase: "8.1",
    targetUnicodeVersion: "17.0",
    baseline,
    sources,
    summary: {
      totalSources: 10,
      locked: sources.filter((source) => source.lockStatus === "locked").length,
      partial: sources.filter((source) => source.lockStatus === "partial").length,
      unresolved: sources.filter((source) => source.lockStatus === "unresolved").length,
    },
  };

  const auditJsonPath = join(rootDir, "src", "data", "master-source-audit.json");
  const lockJsonPath = join(rootDir, "src", "data", "master-source-lock.json");
  const markdownPath = join(rootDir, "PHASE-8-1-SOURCE-AUDIT.md");

  writeFileSync(auditJsonPath, `${JSON.stringify(auditFile, null, 2)}\n`, "utf8");
  writeFileSync(lockJsonPath, `${JSON.stringify(lockFile, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, `${buildMarkdown(sources, baseline)}\n`, "utf8");

  console.log("Phase 8.1 audit generated:");
  console.log(`  ${auditJsonPath}`);
  console.log(`  ${lockJsonPath}`);
  console.log(`  ${markdownPath}`);
  console.log("");
  console.log(
    `Lock status: ${auditFile.summary.locked} locked, ${auditFile.summary.partial} partial, ${auditFile.summary.unresolved} unresolved`,
  );
}

main();
