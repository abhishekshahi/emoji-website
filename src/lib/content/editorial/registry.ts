import type { ContentProvenance } from "../types";

export interface EditorialPost {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly body: readonly { heading?: string; paragraphs: readonly string[] }[];
  readonly language: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly relatedSlugs?: readonly string[];
  readonly provenance: ContentProvenance;
}

const POSTS = new Map<string, EditorialPost>();

export function registerPost(post: EditorialPost): void {
  POSTS.set(post.slug, post);
}

export function getPost(slug: string): EditorialPost | null {
  return POSTS.get(slug) ?? null;
}

export function listPosts(): readonly EditorialPost[] {
  return [...POSTS.values()].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

function bootstrapPosts(): void {
  if (POSTS.size > 0) return;
  const now = new Date().toISOString();
  const provenance = {
    source: "editorial" as const,
    author: "EmojiQuick Editorial",
    lastUpdated: now,
    qualityStatus: "partial" as const,
  };

  registerPost({
    slug: "how-emoji-meanings-evolve",
    title: "How Emoji Meanings Evolve",
    excerpt:
      "Emoji meanings shift with culture, platforms, and context. Here is how EmojiQuick separates Unicode facts from editorial interpretation.",
    language: "en",
    category: "guides",
    tags: ["meanings", "culture", "unicode"],
    publishedAt: now,
    updatedAt: now,
    provenance,
    body: [
      {
        paragraphs: [
          "Unicode and CLDR provide official emoji names and keywords. Over time, communities assign additional meanings — fire for hype, skull for dark humor, and hearts for affection.",
          "EmojiQuick preserves official Unicode data on every page while clearly labeling editorial meaning and usage sections as EmojiQuick interpretation, not Unicode doctrine.",
        ],
      },
    ],
  });

  registerPost({
    slug: "emoji-search-tips",
    title: "Emoji Search Tips on EmojiQuick",
    excerpt: "Search by name, character, Unicode code point, keyword, or natural-language phrase.",
    language: "en",
    category: "guides",
    tags: ["search", "tips"],
    publishedAt: now,
    updatedAt: now,
    relatedSlugs: ["fire", "red-heart"],
    provenance,
    body: [
      {
        heading: "Try different query styles",
        paragraphs: [
          "Search 'heart' for name matches, '❤️' for character matches, 'U+2764' for Unicode lookups, or 'emoji for love' for use-case intent.",
        ],
      },
    ],
  });

  registerPost({
    slug: "emoji-etiquette-basics",
    title: "Emoji Etiquette Basics",
    excerpt: "When to use emoji in work, friends, and public posts — context matters.",
    language: "en",
    category: "guides",
    tags: ["etiquette", "work", "social"],
    publishedAt: now,
    updatedAt: now,
    provenance,
    body: [
      {
        paragraphs: [
          "Emoji tone depends on audience. A thumbs-up works in casual work chat but may feel cold in personal messages. Hearts fit affectionate contexts but can feel too strong in formal email.",
          "EmojiQuick editorial meanings describe common usage — always consider your relationship and platform norms.",
        ],
      },
    ],
  });

  registerPost({
    slug: "unicode-emoji-releases",
    title: "Understanding Unicode Emoji Releases",
    excerpt: "How Unicode versions bring new emoji — and why platforms update at different times.",
    language: "en",
    category: "unicode",
    tags: ["unicode", "releases", "history"],
    publishedAt: now,
    updatedAt: now,
    relatedSlugs: ["party-popper", "fire"],
    provenance,
    body: [
      {
        paragraphs: [
          "The Unicode Consortium publishes new emoji as part of Unicode and Emoji version releases. Vendors like Apple, Google, and Microsoft implement artwork on their own schedules.",
          "EmojiQuick tracks Unicode metadata on each page and editorial notes where helpful — without claiming vendor-specific designs as Unicode standard.",
        ],
      },
    ],
  });

  registerPost({
    slug: "relationship-emoji-guide",
    title: "Relationship Emoji Guide",
    excerpt: "Hearts, kisses, and affection symbols — when each fits best in messages.",
    language: "en",
    category: "guides",
    tags: ["love", "relationships", "hearts"],
    publishedAt: now,
    updatedAt: now,
    relatedSlugs: ["red-heart", "kiss-mark", "smiling-face-with-heart-eyes"],
    provenance,
    body: [
      {
        paragraphs: [
          "Red heart suits broad affection; sparkling heart adds excitement; kiss mark signals romance. Context between partners differs from friends or family.",
          "EmojiQuick editorial pages label interpretation clearly — Unicode names remain the authoritative character identity.",
        ],
      },
    ],
  });

  registerPost({
    slug: "work-emoji-etiquette",
    title: "Work Emoji Etiquette",
    excerpt: "Professional-friendly emoji for email, Slack, and Teams without tone mishaps.",
    language: "en",
    category: "guides",
    tags: ["work", "etiquette", "professional"],
    publishedAt: now,
    updatedAt: now,
    relatedSlugs: ["thumbs-up", "handshake", "check-mark"],
    provenance,
    body: [
      {
        paragraphs: [
          "Thumbs-up and check marks often work in async work chat. Hearts and party poppers may feel too casual for formal email.",
          "When unsure, match your team's norms. EmojiQuick work collections highlight commonly safe picks — not universal rules.",
        ],
      },
    ],
  });

  registerPost({
    slug: "emoji-combinations-guide",
    title: "Emoji Combinations Guide",
    excerpt: "How curated emoji pairs work on EmojiQuick — meaning, context, and when to use them.",
    language: "en",
    category: "guides",
    tags: ["combinations", "generator", "usage"],
    publishedAt: now,
    updatedAt: now,
    relatedSlugs: ["fire", "red-heart", "party-popper"],
    provenance,
    body: [
      {
        heading: "Curated pairs, not random strings",
        paragraphs: [
          "EmojiQuick combinations like ❤️✨ or 🔥💯 are editorial records with meaning, usage, and context — not algorithmically generated permutations.",
          "The combination generator at /combinations/generator maps intents (love, birthday, thanks) to these curated records.",
        ],
      },
      {
        heading: "Unicode vs editorial",
        paragraphs: [
          "Each emoji in a combination links to its canonical identity page with official Unicode data. Combination meaning is EmojiQuick editorial interpretation.",
        ],
      },
    ],
  });
}

bootstrapPosts();
