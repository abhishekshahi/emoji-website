/** Meaning-page definitions — dictionary-style context for high-intent terms. */
export const MEANING_PAGE_SLUGS = [
  "hug",
  "love",
  "cute",
  "sad",
  "crying",
  "angry",
  "shy",
  "thinking",
  "sleepy",
  "cat",
  "dog",
  "happy",
] as const;

export type MeaningPageSlug = (typeof MEANING_PAGE_SLUGS)[number];

const MEANING_SET = new Set<string>(MEANING_PAGE_SLUGS);

export function isMeaningPageSlug(slug: string): slug is MeaningPageSlug {
  return MEANING_SET.has(slug);
}

export interface MeaningPageContent {
  readonly slug: MeaningPageSlug;
  readonly title: string;
  readonly h1: string;
  readonly description: string;
  readonly intro: string;
  readonly usage: string;
  readonly intentSlug: string;
}

const MEANING_CONTENT: Record<MeaningPageSlug, Omit<MeaningPageContent, "slug" | "intentSlug">> = {
  hug: {
    title: "Hug Kaomoji Meaning — Text Hug Emoticons Explained",
    h1: "Hug kaomoji meaning",
    description:
      "Learn what hug kaomoji mean and when to use text hug emoticons. Copy popular hug faces for messages and chats.",
    intro:
      "Hug kaomoji use arms, brackets, and curved characters to suggest embracing someone in text — for example (⊃･ω･)⊃ or (づ｡◕‿◕｡)づ. They communicate warmth, comfort, or support without an emoji sticker.",
    usage:
      "Send a hug kaomoji after good news, when a friend is stressed, or to soften an apology. Shorter hugs fit SMS; wider faces stand out in Discord or Instagram captions.",
  },
  love: {
    title: "Love Kaomoji Meaning — Heart Text Faces Explained",
    h1: "Love kaomoji meaning",
    description:
      "What love kaomoji mean and how to use romantic text faces in messages. Copy heart-style kaomoji on EmojiQuick.",
    intro:
      "Love kaomoji combine hearts, stars, and soft expressions to show affection — like (♥‿♥) or (｡♥‿♥｡). They are popular for couples, crushes, and close friends when words feel too plain.",
    usage:
      "Use love kaomoji in romantic messages, anniversary posts, or playful flirting. Pair with your own words rather than sending the face alone in formal contexts.",
  },
  cute: {
    title: "Cute Kaomoji Meaning — Kawaii Text Faces Explained",
    h1: "Cute kaomoji meaning",
    description:
      "Understand cute kaomoji and kawaii text faces. Copy adorable kaomoji for chats, bios, and social posts.",
    intro:
      "Cute kaomoji emphasize round eyes, small mouths, and gentle punctuation — the kawaii (可愛い) aesthetic in plain text. Examples include (◕‿◕) and (｡･ω･｡).",
    usage:
      "Cute faces work for friendly chats, pet photos, compliments, and lighthearted reactions. They soften tone and feel approachable across age groups.",
  },
  sad: {
    title: "Sad Kaomoji Meaning — Melancholy Text Faces Explained",
    h1: "Sad kaomoji meaning",
    description:
      "What sad kaomoji express and when to use them. Copy melancholy text faces for supportive messages.",
    intro:
      "Sad kaomoji drop the mouth, add tears, or tilt expressions downward — conveying disappointment, loneliness, or empathy. They help you acknowledge feelings without a long paragraph.",
    usage:
      "Use sparingly with friends who understand your tone. Sad kaomoji can show sympathy ('I feel that too') or your own mood after bad news.",
  },
  crying: {
    title: "Crying Kaomoji Meaning — Tearful Text Faces Explained",
    h1: "Crying kaomoji meaning",
    description:
      "Learn crying kaomoji meanings — from happy tears to upset faces. Copy tearful text emoticons.",
    intro:
      "Crying kaomoji add tears (T, ╥, or vertical lines) to show strong emotion — laughing until you cry, frustration, or genuine sadness depending on context.",
    usage:
      "Match the face to your message: happy-cry styles for funny moments; heavy-tear faces for real disappointment. Context from surrounding text matters.",
  },
  angry: {
    title: "Angry Kaomoji Meaning — Frustrated Text Faces Explained",
    h1: "Angry kaomoji meaning",
    description:
      "What angry kaomoji convey in text chat. Copy frustrated or annoyed text faces safely.",
    intro:
      "Angry kaomoji use sharp brows, gritted symbols, or steam-like characters to show annoyance or rage in a playful or emphatic way — rarely for serious threats.",
    usage:
      "Best for gaming rage, joking complaints, or venting to close friends. Avoid in professional or unfamiliar conversations.",
  },
  shy: {
    title: "Shy Kaomoji Meaning — Blushing Text Faces Explained",
    h1: "Shy kaomoji meaning",
    description:
      "Shy and blushing kaomoji meanings explained. Copy bashful text faces for cute reactions.",
    intro:
      "Shy kaomoji hide eyes, blush (//), or look away — signaling embarrassment, humility, or flustered affection after a compliment.",
    usage:
      "Perfect after praise, when asking a small favor, or flirting lightly. They reduce social pressure compared to plain text.",
  },
  thinking: {
    title: "Thinking Kaomoji Meaning — Pondering Text Faces Explained",
    h1: "Thinking kaomoji meaning",
    description:
      "What thinking kaomoji mean in chat. Copy pondering text faces for questions and ideas.",
    intro:
      "Thinking kaomoji use hand-on-chin motifs, dots, or neutral mouths to show consideration — 'hmm', 'let me think', or 'not sure yet'.",
    usage:
      "Use when debating options, responding slowly, or asking someone to wait. Helpful in group chats and brainstorming threads.",
  },
  sleepy: {
    title: "Sleepy Kaomoji Meaning — Tired Text Faces Explained",
    h1: "Sleepy kaomoji meaning",
    description:
      "Sleepy and tired kaomoji meanings. Copy drowsy text faces for late-night messages.",
    intro:
      "Sleepy kaomoji flatten mouths, add zzz, or half-close eyes — signaling fatigue, bedtime, or boring meetings.",
    usage:
      "Send when signing off for the night, after long work, or joking about low energy. Pairs well with good-night messages.",
  },
  cat: {
    title: "Cat Kaomoji Meaning — Neko Text Faces Explained",
    h1: "Cat kaomoji meaning",
    description:
      "Cat (neko) kaomoji meanings and ears in text faces. Copy cat emoticons for pet lovers.",
    intro:
      "Cat kaomoji add ears (=^・^=), whiskers, or 'nya' energy — popular with pet owners and anime fans. They feel playful and internet-native.",
    usage:
      "Great for pet photos, cute reactions, or anime community posts. Many cat faces are also classified as cute or kawaii.",
  },
  dog: {
    title: "Dog Kaomoji Meaning — Puppy Text Faces Explained",
    h1: "Dog kaomoji meaning",
    description:
      "Dog kaomoji meanings for puppy-style text faces. Copy dog emoticons for friendly chats.",
    intro:
      "Dog kaomoji use ears, tongues, or loyal expressions — softer and goofier than cat faces for many readers.",
    usage:
      "Use with pet content, enthusiastic greetings, or when you want a friendly loyal tone.",
  },
  happy: {
    title: "Happy Kaomoji Meaning — Joyful Text Faces Explained",
    h1: "Happy kaomoji meaning",
    description:
      "Happy kaomoji meanings — smiles and joyful text faces explained. Copy happy emoticons.",
    intro:
      "Happy kaomoji lift mouths, widen eyes, or add sparkles to show joy, celebration, or good news — the most universal kaomoji mood.",
    usage:
      "Default choice for congratulations, weekend plans, or any positive reply. Wide variety from minimal :) to elaborate Unicode art.",
  },
};

export function getMeaningPageContent(slug: string): MeaningPageContent | null {
  if (!isMeaningPageSlug(slug)) return null;
  const base = MEANING_CONTENT[slug];
  return { slug, intentSlug: slug, ...base };
}

export function buildMeaningPagePath(slug: MeaningPageSlug): string {
  return `/kaomoji/meaning/${slug}`;
}
