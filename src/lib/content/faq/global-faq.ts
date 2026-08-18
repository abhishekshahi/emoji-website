import type { FaqSection } from "./types";

const now = new Date().toISOString();
const editorial = {
  source: "editorial" as const,
  author: "EmojiQuick Editorial",
  lastUpdated: now,
  qualityStatus: "partial" as const,
};

export const GLOBAL_FAQ_SECTIONS: readonly FaqSection[] = [
  {
    id: "general",
    title: "General emoji questions",
    items: [
      {
        id: "what-is-emoji",
        question: "What is an emoji?",
        answer:
          "An emoji is a pictographic character encoded in Unicode. EmojiQuick helps you find, copy, and understand emojis with Unicode details and artwork.",
        category: "general",
        provenance: editorial,
      },
      {
        id: "what-does-fire-mean",
        question: "What does 🔥 mean?",
        answer:
          "Fire often means something is hot, exciting, trending, or impressive. See the fire emoji page for Unicode details and editorial meaning notes.",
        category: "general",
        relatedSlugs: ["fire"],
        provenance: editorial,
      },
      {
        id: "what-does-heart-mean",
        question: "What does ❤️ mean?",
        answer:
          "The red heart emoji commonly represents love, affection, or gratitude. Unicode provides the official name; EmojiQuick adds editorial usage context on each page.",
        category: "general",
        relatedSlugs: ["red-heart"],
        provenance: editorial,
      },
      {
        id: "when-use-fire",
        question: "When should I use the fire emoji?",
        answer:
          "Use 🔥 for hype, compliments, or trending topics — not for emergencies or sensitive news. See the fire emoji page for editorial when-to-use notes.",
        category: "general",
        relatedSlugs: ["fire"],
        provenance: editorial,
      },
      {
        id: "difference-heart-hearts",
        question: "What is the difference between ❤️ and 💕?",
        answer:
          "The red heart is the most universal love symbol. Revolving hearts and other heart variants add softer or more playful romantic tone. Compare pages on EmojiQuick for Unicode names and editorial notes.",
        category: "general",
        relatedSlugs: ["red-heart", "revolving-hearts"],
        provenance: editorial,
      },
      {
        id: "texting-meaning",
        question: "What does an emoji mean in texting?",
        answer:
          "Context matters: the same emoji can mean hype, humor, or affection depending on the conversation. EmojiQuick separates Unicode official names from editorial usage guidance on each page.",
        category: "general",
        provenance: editorial,
      },
    ],
  },
  {
    id: "unicode",
    title: "Unicode",
    items: [
      {
        id: "unicode-codepoint",
        question: "What is the Unicode code point for 🔥?",
        answer:
          "Fire is U+1F525. Each EmojiQuick emoji page shows code points, sequences, and copy-friendly formats.",
        category: "unicode",
        relatedSlugs: ["fire"],
        provenance: editorial,
      },
      {
        id: "zwj-sequences",
        question: "What are ZWJ emoji sequences?",
        answer:
          "Zero Width Joiner (ZWJ) sequences combine multiple code points into a single emoji, such as family groups or flags. EmojiQuick documents full sequences on detail pages.",
        category: "unicode",
        provenance: editorial,
      },
    ],
  },
  {
    id: "copying",
    title: "Copying emojis",
    items: [
      {
        id: "how-copy",
        question: "How do I copy an emoji?",
        answer:
          "Click the copy button on any EmojiQuick emoji page. The actual emoji character is copied to your clipboard — not the slug or metadata.",
        category: "copying",
        provenance: editorial,
      },
      {
        id: "copy-mobile",
        question: "How do I copy emojis on iPhone or Android?",
        answer:
          "On EmojiQuick, tap the copy button on an emoji detail page. You can also use your device's native emoji keyboard in most apps.",
        category: "copying",
        provenance: editorial,
      },
    ],
  },
  {
    id: "searching",
    title: "Searching emojis",
    items: [
      {
        id: "search-by-name",
        question: "How do I search emojis by name?",
        answer:
          "Use the search bar for names like 'heart' or 'fire'. EmojiQuick also supports Unicode queries (U+1F525), emoji characters, and natural phrases.",
        category: "searching",
        provenance: editorial,
      },
    ],
  },
  {
    id: "artwork",
    title: "Artwork",
    items: [
      {
        id: "artwork-providers",
        question: "Which artwork providers does EmojiQuick use?",
        answer:
          "EmojiQuick resolves artwork from Noto, Fluent, OpenMoji, and Twemoji with license-aware priority. See the artwork page for provider details.",
        category: "artwork",
        provenance: editorial,
      },
    ],
  },
  {
    id: "combinations",
    title: "Emoji combinations",
    items: [
      {
        id: "what-is-combination",
        question: "What is an emoji combination?",
        answer:
          "An emoji combination is a short sequence of emojis used together to express a mood or idea — like ❤️✨ for love with flair. EmojiQuick curates editorial combinations with meanings.",
        category: "combinations",
        provenance: editorial,
      },
      {
        id: "combination-generator",
        question: "How does the combination generator work?",
        answer:
          "The generator at /combinations/generator returns curated editorial combinations by mood or intent — not random sequences.",
        category: "combinations",
        provenance: editorial,
      },
    ],
  },
  {
    id: "multilingual",
    title: "Multilingual emojis",
    items: [
      {
        id: "localized-pages",
        question: "Does EmojiQuick support other languages?",
        answer:
          "EmojiQuick supports localized keyword search and publishes localized emoji pages only where translation content exists. English URLs remain canonical.",
        category: "multilingual",
        provenance: editorial,
      },
    ],
  },
  {
    id: "features",
    title: "Favorites and recent",
    items: [
      {
        id: "favorites-how",
        question: "How do favorites work?",
        answer:
          "Favorites are stored locally in your browser. No account is required. They persist until you clear browser data.",
        category: "features",
        provenance: editorial,
      },
      {
        id: "recent-how",
        question: "How does recently used work?",
        answer:
          "Recently copied emojis are saved in browser local storage for quick access on the homepage and recent page.",
        category: "features",
        provenance: editorial,
      },
    ],
  },
  {
    id: "unicode-advanced",
    title: "Unicode details",
    items: [
      {
        id: "skin-tones",
        question: "What are emoji skin tone modifiers?",
        answer:
          "Unicode skin tone modifiers (Fitzpatrick types) attach to supported people and hand emojis. EmojiQuick documents variants on detail pages.",
        category: "unicode",
        provenance: editorial,
      },
      {
        id: "flags",
        question: "How do flag emojis work?",
        answer:
          "Flag emojis are typically regional indicator sequences. EmojiQuick shows the full Unicode sequence on each flag page.",
        category: "unicode",
        provenance: editorial,
      },
      {
        id: "zwj-sequences",
        question: "What are ZWJ emoji sequences?",
        answer:
          "Zero Width Joiner (ZWJ) sequences combine multiple code points into one emoji — like family groups or profession variants. EmojiQuick shows the full sequence on detail pages.",
        category: "unicode",
        provenance: editorial,
      },
      {
        id: "gender-variants",
        question: "How do gender variants work in emoji?",
        answer:
          "Some people emojis support gender modifiers or separate male/female/neutral code points. EmojiQuick lists available variants without claiming one is the official default.",
        category: "unicode",
        provenance: editorial,
      },
      {
        id: "keycap-emoji",
        question: "How do keycap emojis work?",
        answer:
          "Keycap sequences combine a digit or symbol with U+FE0F and U+20E3. Search by number name or Unicode on EmojiQuick to find the right keycap.",
        category: "unicode",
        provenance: editorial,
      },
      {
        id: "emoji-version",
        question: "What Unicode version added my emoji?",
        answer:
          "Each emoji page shows Unicode metadata where available. Newer emojis may not render on older devices until vendors update their fonts.",
        category: "unicode",
        provenance: editorial,
      },
    ],
  },
  {
    id: "platforms",
    title: "Platform differences",
    items: [
      {
        id: "why-look-different",
        question: "Why does the same emoji look different on iPhone and Android?",
        answer:
          "Each platform vendor designs its own artwork. Unicode defines the character; Apple, Google, Microsoft, and others implement distinct visuals. EmojiQuick offers multiple artwork styles where available.",
        category: "platforms",
        provenance: editorial,
      },
      {
        id: "artwork-styles",
        question: "What artwork styles does EmojiQuick show?",
        answer:
          "EmojiQuick may show Noto, Fluent, OpenMoji, Twemoji, and fallbacks depending on availability — all served privately, not as public R2 URLs.",
        category: "platforms",
        provenance: editorial,
      },
      {
        id: "copy-vs-artwork",
        question: "Does copying an emoji copy the artwork?",
        answer:
          "Copying inserts the Unicode character. The recipient's device chooses how it renders — artwork previews on EmojiQuick are for reference only.",
        category: "platforms",
        provenance: editorial,
      },
    ],
  },
  {
    id: "search-faq",
    title: "Search and combinations",
    items: [
      {
        id: "natural-language-search",
        question: "Can I search in plain English?",
        answer:
          "Yes. Try phrases like 'emoji for birthday', 'emoji for love', or 'what does fire mean'. EmojiQuick ranks exact matches and intent before popularity.",
        category: "search",
        provenance: editorial,
      },
      {
        id: "zero-results",
        question: "What if search finds nothing?",
        answer:
          "EmojiQuick suggests spelling fixes, related searches, and category hints — not unrelated popular emojis pretending to match.",
        category: "search",
        provenance: editorial,
      },
      {
        id: "combinations-vs-generator",
        question: "What is the combination generator?",
        answer:
          "The generator at /combinations/generator returns curated editorial combinations by mood or intent — not random emoji strings.",
        category: "combinations",
        provenance: editorial,
      },
      {
        id: "multilingual-search",
        question: "Does EmojiQuick support non-English search?",
        answer:
          "Localized keywords exist for high-value emojis. Full multilingual search expands as verified translations are published — see localized emoji pages under /es/, /fr/, /hi/, and others.",
        category: "multilingual",
        provenance: editorial,
      },
      {
        id: "skin-tones",
        question: "How do emoji skin tones work?",
        answer:
          "Many human emoji support Fitzpatrick skin tone modifiers (Unicode). EmojiQuick lists variants on each identity page — official Unicode metadata is separate from editorial usage notes.",
        category: "unicode",
        provenance: editorial,
      },
      {
        id: "zwj-sequences",
        question: "What are ZWJ emoji sequences?",
        answer:
          "Zero Width Joiner (ZWJ) sequences combine emoji into single glyphs — like family or profession variants. EmojiQuick treats each canonical identity separately; ZWJ details appear in Unicode sections.",
        category: "unicode",
        provenance: editorial,
      },
      {
        id: "trending-curated",
        question: "Why does EmojiQuick say TRENDING / CURATED?",
        answer:
          "Live trending requires enough real aggregate analytics (1,000+ legitimate events) with quality gates passed. Until then, EmojiQuick shows editorial curated picks — never fabricated traffic.",
        category: "analytics",
        provenance: editorial,
      },
    ],
  },
  {
    id: "emojiquick",
    title: "EmojiQuick usage",
    items: [
      {
        id: "accounts",
        question: "Do I need an account?",
        answer:
          "No. EmojiQuick does not require accounts for browsing, searching, or copying emojis. Favorites and recent emojis are stored locally in your browser.",
        category: "emojiquick",
        provenance: editorial,
      },
      {
        id: "privacy",
        question: "What data does EmojiQuick collect?",
        answer:
          "Favorites and recent emojis may be stored in browser local storage. Discovery rankings use editorial baselines unless live analytics are explicitly enabled.",
        category: "emojiquick",
        provenance: editorial,
      },
      {
        id: "content-coverage",
        question: "How much emoji meaning content does EmojiQuick have?",
        answer:
          "EmojiQuick publishes editorial meanings for high-value emojis first. See /content-coverage for honest rich, partial, and missing counts.",
        category: "emojiquick",
        provenance: editorial,
      },
    ],
  },
];

export function getAllFaqItems() {
  return GLOBAL_FAQ_SECTIONS.flatMap((section) => section.items);
}

export function getFaqItemById(id: string) {
  return getAllFaqItems().find((item) => item.id === id) ?? null;
}
