import type { UnicodeMilestone, UnicodeVersionRecord } from "./types";

const VERSIONS: UnicodeVersionRecord[] = [];
const MILESTONES: UnicodeMilestone[] = [];

const now = new Date().toISOString();
const official = {
  source: "official" as const,
  lastUpdated: now,
  qualityStatus: "partial" as const,
};

function bootstrap(): void {
  if (VERSIONS.length > 0) return;

  VERSIONS.push(
    {
      version: "6.0",
      emojiVersion: "1.0",
      releaseDate: "2010-10",
      summary: "Early emoji characters added to Unicode — foundational pictographs.",
      milestone: true,
      provenance: official,
    },
    {
      version: "8.0",
      emojiVersion: "1.0",
      releaseDate: "2015-06",
      summary: "Skin tone modifiers and expanded emoji support.",
      provenance: official,
    },
    {
      version: "9.0",
      emojiVersion: "3.0",
      releaseDate: "2016-06",
      summary: "Emoji version 3.0 — additional symbols and sequences.",
      provenance: official,
    },
    {
      version: "11.0",
      emojiVersion: "11.0",
      releaseDate: "2018-06",
      summary: "Major emoji expansion including hair styles and additional faces.",
      milestone: true,
      provenance: official,
    },
    {
      version: "13.0",
      emojiVersion: "13.0",
      releaseDate: "2020-03",
      summary: "Emoji 13.0 release with new symbols and gender-neutral options.",
      provenance: official,
    },
    {
      version: "15.0",
      emojiVersion: "15.0",
      releaseDate: "2022-09",
      summary: "Emoji 15.0 — shaking face, pink heart, and other additions.",
      provenance: official,
    },
    {
      version: "15.1",
      emojiVersion: "15.1",
      releaseDate: "2023-09",
      summary: "Emoji 15.1 minor update with additional sequences.",
      provenance: official,
    },
  );

  MILESTONES.push(
    {
      id: "emoji-encoding",
      title: "Emoji encoded in Unicode",
      description:
        "Emoji became standardized Unicode characters, enabling cross-platform compatibility.",
      year: 2010,
      provenance: official,
    },
    {
      id: "skin-tones",
      title: "Skin tone modifiers",
      description: "Fitzpatrick skin tone modifiers (U+1F3FB–U+1F3FF) enable diverse representation.",
      year: 2015,
      provenance: official,
    },
    {
      id: "gender-neutral",
      title: "Gender-neutral emoji options",
      description: "Unicode expanded gender presentation options across professions and people emoji.",
      year: 2019,
      provenance: official,
    },
  );
}

bootstrap();

export function listUnicodeVersions(): readonly UnicodeVersionRecord[] {
  return VERSIONS;
}

export function listUnicodeMilestones(): readonly UnicodeMilestone[] {
  return MILESTONES;
}
