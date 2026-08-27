/** Use-case / context SEO pages — map to editorial collections where possible. */
export const USE_CASE_PAGE_SLUGS = [
  "texting",
  "discord",
  "instagram",
  "whatsapp",
  "friendship",
  "couples",
  "gaming",
  "social-media",
  "messages",
  "captions",
] as const;

export type UseCasePageSlug = (typeof USE_CASE_PAGE_SLUGS)[number];

const USE_CASE_SET = new Set<string>(USE_CASE_PAGE_SLUGS);

export function isUseCasePageSlug(slug: string): slug is UseCasePageSlug {
  return USE_CASE_SET.has(slug);
}

export interface UseCasePageContent {
  readonly slug: UseCasePageSlug;
  readonly title: string;
  readonly h1: string;
  readonly description: string;
  readonly intro: string;
  readonly tips: string;
  readonly collectionSlug: string | null;
  readonly relatedIntentSlugs: readonly string[];
}

const USE_CASE_CONTENT: Record<UseCasePageSlug, Omit<UseCasePageContent, "slug">> = {
  texting: {
    title: "Kaomoji for Texting — Short Copy-Paste Text Faces",
    h1: "Kaomoji for texting",
    description:
      "Short kaomoji for SMS and texting. Copy compact text faces that fit message limits and plain-text apps.",
    intro:
      "Texting favors short kaomoji — usually under 12 characters — so they send cleanly on SMS and older phones. EmojiQuick surfaces compact public kaomoji sorted by quality.",
    tips:
      "Pick minimal faces like (^_^) or (♥‿♥) for reliability. Avoid extremely wide Unicode art that may wrap awkwardly in SMS threads.",
    collectionSlug: "kaomoji-for-texting",
    relatedIntentSlugs: ["cute", "happy", "love"],
  },
  discord: {
    title: "Kaomoji for Discord — Copy Text Faces for Chat",
    h1: "Kaomoji for Discord",
    description:
      "Kaomoji for Discord messages, status text, and usernames. Copy Unicode text faces that render in Discord.",
    intro:
      "Discord supports full Unicode in messages and many profile fields. Kaomoji add personality in servers, DMs, and custom status lines without custom emoji uploads.",
    tips:
      "Test longer decorative kaomoji in your server — most Unicode faces render well. Combine with markdown sparingly so the face stays readable.",
    collectionSlug: "kaomoji-for-discord",
    relatedIntentSlugs: ["funny", "gaming", "aesthetic"],
  },
  instagram: {
    title: "Kaomoji for Instagram — Bios & Captions",
    h1: "Kaomoji for Instagram",
    description:
      "Copy kaomoji for Instagram bios, captions, and comments. Aesthetic and cute text faces for social posts.",
    intro:
      "Instagram bios and captions benefit from distinctive kaomoji — especially aesthetic and cute styles that stand out in plain text fields.",
    tips:
      "Keep bios under the character limit; preview on mobile. Aesthetic and kawaii categories offer decorative options for profile branding.",
    collectionSlug: "kaomoji-for-instagram",
    relatedIntentSlugs: ["aesthetic", "cute", "kawaii"],
  },
  whatsapp: {
    title: "Kaomoji for WhatsApp — Chat Text Faces",
    h1: "Kaomoji for WhatsApp",
    description:
      "Kaomoji for WhatsApp chats and status. Copy short text faces that work across devices.",
    intro:
      "WhatsApp handles Unicode well on modern phones. Shorter kaomoji send reliably to mixed Android and iOS groups.",
    tips:
      "Prefer compact faces for group chats. Save elaborate kaomoji for one-to-one conversations where you know recipients' devices.",
    collectionSlug: "kaomoji-for-whatsapp",
    relatedIntentSlugs: ["happy", "love", "cute"],
  },
  friendship: {
    title: "Kaomoji for Friends — Friendly Text Faces",
    h1: "Kaomoji for friends",
    description:
      "Friendly kaomoji for friends — greetings, inside jokes, and supportive messages. Copy and paste text faces.",
    intro:
      "Friendship kaomoji include waves, hugs, and playful faces that signal warmth without romantic intent — ideal for group chats and long-time friends.",
    tips:
      "Rotate styles so messages feel fresh. Greeting and friendship taxonomy categories offer good starting points.",
    collectionSlug: "kaomoji-for-friendship",
    relatedIntentSlugs: ["happy", "hug", "funny"],
  },
  couples: {
    title: "Kaomoji for Couples — Romantic Text Faces",
    h1: "Kaomoji for couples",
    description:
      "Romantic kaomoji for couples — love, kiss, and hug text faces to copy for partners.",
    intro:
      "Couples often use love, kiss, and hug kaomoji for daily affection — anniversaries, good morning texts, or playful flirting.",
    tips:
      "Match intensity to your relationship stage. Heart-heavy faces for romance; shy faces for newer couples.",
    collectionSlug: "kaomoji-for-couples",
    relatedIntentSlugs: ["love", "kiss", "hug"],
  },
  gaming: {
    title: "Kaomoji for Gaming — Chat Reactions & Rage Faces",
    h1: "Kaomoji for gaming",
    description:
      "Kaomoji for gaming chats — reactions, rage faces, and victory text emoticons to copy.",
    intro:
      "Gaming communities use kaomoji for post-match reactions, friendly trash talk, and celebratory messages in Discord or in-game chat where Unicode works.",
    tips:
      "Funny, angry, and happy categories cover most gaming moments. Keep faces short if the game chat has strict character limits.",
    collectionSlug: null,
    relatedIntentSlugs: ["angry", "funny", "happy"],
  },
  "social-media": {
    title: "Kaomoji for Social Media — Captions & Comments",
    h1: "Kaomoji for social media",
    description:
      "Kaomoji for social media posts, stories, and comments. Copy text faces for every platform.",
    intro:
      "Social posts use kaomoji to add tone in captions and comments where emoji picker options feel generic. Works on X, TikTok, Facebook, and threads.",
    tips:
      "Platform limits vary — test on mobile. Aesthetic kaomoji suit visual platforms; minimal faces suit text-heavy networks.",
    collectionSlug: "kaomoji-for-instagram",
    relatedIntentSlugs: ["aesthetic", "cute", "happy"],
  },
  messages: {
    title: "Kaomoji for Messages — iMessage & Chat Apps",
    h1: "Kaomoji for messages",
    description:
      "Kaomoji for iMessage, Telegram, and messaging apps. Copy Unicode text faces for everyday chat.",
    intro:
      "Modern messaging apps render Unicode kaomoji consistently. Choose length based on your app's bubble width and your recipient's device.",
    tips:
      "For professional contacts, use subtle faces. For close friends, explore decorative and anime-style categories.",
    collectionSlug: "kaomoji-for-texting",
    relatedIntentSlugs: ["happy", "cute", "shy"],
  },
  captions: {
    title: "Kaomoji for Captions — Photo & Video Text",
    h1: "Kaomoji for captions",
    description:
      "Kaomoji for photo and video captions. Copy expressive text faces that complement visual content.",
    intro:
      "Captions benefit from kaomoji that match photo mood — cute for pets, aesthetic for travel, love for couples shots.",
    tips:
      "Place kaomoji at the start or end of captions for scannability. Avoid overcrowding hashtags with complex Unicode.",
    collectionSlug: "kaomoji-for-instagram",
    relatedIntentSlugs: ["aesthetic", "cute", "love"],
  },
};

export function getUseCasePageContent(slug: string): UseCasePageContent | null {
  if (!isUseCasePageSlug(slug)) return null;
  return { slug, ...USE_CASE_CONTENT[slug] };
}

export function buildUseCasePagePath(slug: UseCasePageSlug): string {
  return `/kaomoji/for/${slug}`;
}
