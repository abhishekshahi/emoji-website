export interface InvisibleToolPage {
  readonly slug: string;
  readonly title: string;
  readonly h1: string;
  readonly description: string;
  readonly intro: string;
  readonly path: string;
}

export const INVISIBLE_TOOL_SLUGS = [
  "generator",
  "inspector",
  "cleaner",
] as const;

export type InvisibleToolSlug = (typeof INVISIBLE_TOOL_SLUGS)[number];

const SLUG_SET = new Set<string>(INVISIBLE_TOOL_SLUGS);

const PAGES: Record<InvisibleToolSlug, InvisibleToolPage> = {
  generator: {
    slug: "generator",
    title: "Invisible Character Generator — Copy Zero-Width Unicode",
    h1: "Invisible character generator",
    description:
      "Select a supported zero-width Unicode character, preview its code point, and copy the exact character. Client-side only — nothing is sent to a server.",
    intro:
      "Generate and copy individual invisible Unicode characters for legitimate text formatting. Each character shows its name and U+ code point — never rely on blank visual space alone.",
    path: "/tools/invisible-characters/generator",
  },
  inspector: {
    slug: "inspector",
    title: "Invisible Character Inspector — Detect Hidden Unicode",
    h1: "Invisible character inspector",
    description:
      "Paste text to inspect visible and invisible Unicode characters, code points, and bidirectional controls. 100% client-side — your text never leaves the browser.",
    intro:
      "Paste or type text to see every code point, highlight invisible characters, and detect risky bidirectional controls. Original and visualized views are shown separately.",
    path: "/tools/invisible-characters/inspector",
  },
  cleaner: {
    slug: "cleaner",
    title: "Remove Invisible Characters — Explicit Unicode Cleaner",
    h1: "Remove invisible characters",
    description:
      "Explicitly remove selected invisible Unicode characters from pasted text. Preview counts before and after — client-side processing only.",
    intro:
      "Choose which invisible characters to remove, preview the count, then copy cleaned text. ZWJ is excluded by default to avoid breaking emoji sequences.",
    path: "/tools/invisible-characters/cleaner",
  },
};

export function isInvisibleToolSlug(slug: string): slug is InvisibleToolSlug {
  return SLUG_SET.has(slug);
}

export function getInvisibleToolPage(slug: string): InvisibleToolPage | null {
  if (!isInvisibleToolSlug(slug)) return null;
  return PAGES[slug];
}

export function listInvisibleToolPages(): readonly InvisibleToolPage[] {
  return INVISIBLE_TOOL_SLUGS.map((s) => PAGES[s]);
}

export const INVISIBLE_TOOLS_INDEX = {
  title: "Invisible Character Tools — Unicode Utilities",
  h1: "Invisible character tools",
  description:
    "Copy, inspect, and remove invisible Unicode characters safely. Client-side tools for zero-width space, joiners, and whitespace inspection.",
  path: "/tools/invisible-characters",
  intro:
    "Legitimate utilities for working with invisible Unicode characters. All processing happens in your browser — pasted text is never sent to EmojiQuick servers.",
} as const;
