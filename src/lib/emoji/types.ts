export type EmojiQualificationStatus =
  | "fully-qualified"
  | "minimally-qualified"
  | "unqualified"
  | "component";

export type EmojiSequenceKind =
  | "single"
  | "multi"
  | "zwj"
  | "skin-tone"
  | "gender"
  | "flag"
  | "keycap";

export type UnicodeSequenceType =
  | "Basic_Emoji"
  | "Emoji_Keycap_Sequence"
  | "RGI_Emoji_Flag_Sequence"
  | "RGI_Emoji_Tag_Sequence"
  | "RGI_Emoji_Modifier_Sequence"
  | "RGI_Emoji_ZWJ_Sequence";

export type UnicodeDataSource =
  | "emoji-test"
  | "emoji-sequences"
  | "emoji-zwj-sequences";

export interface EmojiSequenceInfo {
  kind: EmojiSequenceKind;
  status: EmojiQualificationStatus;
  unicodeSequenceType?: UnicodeSequenceType;
  hasVariationSelector: boolean;
  hasZeroWidthJoiner: boolean;
  isRGI: boolean;
  sources: UnicodeDataSource[];
}

export interface EmojiRecord {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  category: string;
  subcategory: string;
  keywords: string[];
  shortcodes: string[];
  unicodeVersion: string;
  codePoints: string[];
  codePointsDecimal: number[];
  codePointString: string;
  hexcode: string;
  sequence: EmojiSequenceInfo;
  order?: number;
  gender?: 0 | 1;
  skinTone?: 1 | 2 | 3 | 4 | 5 | Array<1 | 2 | 3 | 4 | 5>;
}

export interface EmojiCategory {
  id: string;
  label: string;
  subcategories: Array<{
    id: string;
    label: string;
  }>;
}

export interface EmojiDatasetManifest {
  generatedAt: string;
  emojiVersion: string;
  unicodeSource: string;
  emojibaseVersion: string;
  recordCount: number;
  categoryCount: number;
  validation: {
    duplicateIds: string[];
    duplicateSlugs: string[];
  };
  indexes: {
    bySlug: Record<string, string>;
    byHexcode: Record<string, string>;
  };
  categories: EmojiCategory[];
  stats: {
    fullyQualified: number;
    withKeywords: number;
    withShortcodes: number;
    sequenceKinds: Record<EmojiSequenceKind, number>;
  };
}

export interface EmojiDataset {
  manifest: EmojiDatasetManifest;
  emojis: EmojiRecord[];
}

export type OpenMojiExtraGroup = "extras-openmoji" | "extras-unicode";

export interface OpenMojiExtraRecord {
  id: string;
  emoji: string;
  name: string;
  slug: string;
  category: string;
  subcategory: string;
  keywords: string[];
  shortcodes: string[];
  unicodeVersion: string;
  codePoints: string[];
  codePointsDecimal: number[];
  codePointString: string;
  hexcode: string;
  sequence: EmojiSequenceInfo;
  openmojiGroup: OpenMojiExtraGroup;
  openmojiAuthor: string;
  openmojiDate: string;
  isOpenMojiExtra: true;
}

export interface OpenMojiExtrasManifest {
  generatedAt: string;
  openmojiVersion: string;
  recordCount: number;
  categoryCount: number;
  openmojiGroupCounts: Record<OpenMojiExtraGroup, number>;
  categories: EmojiCategory[];
  subgroupLabels: Record<string, string>;
  subgroupEmojis: Record<string, string>;
  indexes: {
    bySlug: Record<string, string>;
    byHexcode: Record<string, string>;
  };
}

export type BrowsableEmoji = EmojiRecord | OpenMojiExtraRecord;

export function isOpenMojiExtra(
  emoji: BrowsableEmoji,
): emoji is OpenMojiExtraRecord {
  return "isOpenMojiExtra" in emoji && emoji.isOpenMojiExtra === true;
}
