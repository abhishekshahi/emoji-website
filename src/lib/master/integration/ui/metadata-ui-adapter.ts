import { getEnrichedMetadata } from "../metadata/enrichment";
import { getSourceMetadata, getSourceMetadataAvailability } from "../metadata/sources";
import type { MetadataSourceKey } from "../metadata/types";
import { getMasterReader } from "../master-reader";
import type { UiMetadataPayload, UiSourceMetadataPanel } from "./types";

const SOURCE_ORDER: readonly (MetadataSourceKey | "noto" | "twemoji")[] = [
  "unicode",
  "cldr",
  "openmoji",
  "emojibase",
  "emojilib",
  "fluent",
  "emoji-time",
  "noto",
  "twemoji",
];

const SOURCE_LABELS: Readonly<Record<MetadataSourceKey | "noto" | "twemoji", string>> = Object.freeze({
  unicode: "Unicode",
  cldr: "CLDR",
  openmoji: "OpenMoji",
  emojibase: "Emojibase",
  emojilib: "Emojilib",
  emojinet: "EmojiNet",
  fluent: "Fluent",
  "emoji-time": "Emoji Time",
  noto: "Noto",
  twemoji: "Twemoji",
});

const MAX_UI_KEYWORDS = 12;
const MAX_UI_ALIASES = 8;
const MAX_UI_SHORTCODES = 8;

function buildSourcePanel(
  canonicalId: string,
  source: MetadataSourceKey | "noto" | "twemoji",
  rootDir?: string,
): UiSourceMetadataPanel {
  if (source === "noto" || source === "twemoji") {
    return Object.freeze({
      source,
      label: SOURCE_LABELS[source],
      available: false,
      name: null,
      keywords: Object.freeze([]),
      aliases: Object.freeze([]),
      shortcodes: Object.freeze([]),
      definition: null,
      sourceVersion: null,
    });
  }

  const record = getSourceMetadata(canonicalId, source, rootDir);
  if (!record || !("metadataAvailable" in record) || !record.metadataAvailable) {
    return Object.freeze({
      source,
      label: SOURCE_LABELS[source],
      available: false,
      name: null,
      keywords: Object.freeze([]),
      aliases: Object.freeze([]),
      shortcodes: Object.freeze([]),
      definition: null,
      sourceVersion: null,
    });
  }

  return Object.freeze({
    source,
    label: SOURCE_LABELS[source],
    available: true,
    name: record.name,
    keywords: Object.freeze(record.keywords.slice(0, MAX_UI_KEYWORDS)),
    aliases: Object.freeze(record.aliases.slice(0, MAX_UI_ALIASES)),
    shortcodes: Object.freeze(record.shortcodes.slice(0, MAX_UI_SHORTCODES)),
    definition: record.definition,
    sourceVersion: record.sourceVersion,
  });
}

export function getUiMetadataPayload(canonicalId: string, rootDir?: string): UiMetadataPayload | null {
  const enriched = getEnrichedMetadata(canonicalId, rootDir);
  if (!enriched) {
    return null;
  }

  const canonical = getMasterReader(rootDir).canonicalRecords.get(canonicalId);

  const sourcePanels = Object.freeze(
    SOURCE_ORDER.map((source) => buildSourcePanel(canonicalId, source, rootDir)),
  );

  const safeKeywords = enriched.canonicalKeywords
    .map((entry) => entry.value)
    .slice(0, MAX_UI_KEYWORDS);

  const safeAliases = enriched.safeAliases.map((alias) => alias.value).slice(0, MAX_UI_ALIASES);
  const shortcodes = enriched.shortcodeRecords
    .map((entry) => entry.shortcode)
    .slice(0, MAX_UI_SHORTCODES);

  return Object.freeze({
    canonicalId,
    canonicalName: enriched.canonicalName.value,
    emoji: canonical?.emoji ?? null,
    safeKeywords: Object.freeze(safeKeywords),
    safeAliases: Object.freeze(safeAliases),
    shortcodes: Object.freeze(shortcodes),
    sourcePanels,
  });
}

export function listUiAvailableMetadataSources(canonicalId: string, rootDir?: string): readonly MetadataSourceKey[] {
  const availability = getSourceMetadataAvailability(canonicalId, rootDir);
  return Object.freeze(
    (Object.keys(availability) as Array<MetadataSourceKey | "noto" | "twemoji">)
      .filter((source): source is MetadataSourceKey => source !== "noto" && source !== "twemoji")
      .filter((source) => availability[source]),
  );
}
