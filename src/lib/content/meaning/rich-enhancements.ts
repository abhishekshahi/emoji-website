import type { EmojiMeaningRecord } from "./types";

/** Overrides templated Tier-1 records with richer editorial content. */
export function registerRichEnhancements(
  registerMeaning: (record: EmojiMeaningRecord) => void,
  base: { language: "en"; provenance: EmojiMeaningRecord["provenance"] },
): void {
  const complete = {
    ...base.provenance,
    qualityStatus: "complete" as const,
    lastUpdated: new Date().toISOString(),
  };

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F525",
    slug: "fire",
    contentTier: "rich",
    summary: "Signals heat, hype, excellence, or something trending.",
    literalMeaning: "A flame — heat and burning.",
    meaning:
      "EmojiQuick editorial: Often means something is excellent, intense, attractive, or trending — not literally on fire.",
    emotionalMeaning: "Excitement, admiration, or playful exaggeration.",
    usage: "React to great news, viral moments, sports highlights, or 'this slaps' energy.",
    whenToUse: "Compliments, hype reactions, trending topics.",
    whenNotToUse: "Actual emergencies, wildfire news, or formal workplace praise where tone may misfire.",
    context: "Social media, texting, gaming chat",
    interpretations: ["hot/trending", "excellent", "lit", "attractive"],
    misunderstandings: ["Not always literal fire — context decides."],
    examples: ["That mix 🔥", "Your fit is fire", "This track is 🔥🔥"],
    relatedConcepts: ["hype", "trending", "excellent"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:2764",
    slug: "red-heart",
    contentTier: "rich",
    summary: "Classic symbol of love, affection, and care.",
    literalMeaning: "A red heart shape.",
    meaning:
      "EmojiQuick editorial: Love, romance, deep affection, or sincere appreciation depending on relationship.",
    emotionalMeaning: "Warmth, devotion, gratitude.",
    usage: "Messages to partners, family, close friends, or posts celebrating people you care about.",
    whenToUse: "Valentines, anniversaries, thank-you notes with warmth.",
    whenNotToUse: "Cold professional email where hearts may feel too personal.",
    context: "Texting, Instagram captions, dating apps",
    interpretations: ["love", "romance", "I care", "thank you warmly"],
    misunderstandings: ["Strength varies — close friends vs partners interpret differently."],
    examples: ["Love you ❤️", "Thanks for everything ❤️", "Happy anniversary ❤️"],
    relatedConcepts: ["love", "romance", "affection"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F602",
    slug: "face-with-tears-of-joy",
    contentTier: "rich",
    summary: "Laughing so hard you're crying — peak humor reaction.",
    literalMeaning: "A smiling face with tears streaming.",
    meaning:
      "EmojiQuick editorial: Intense laughter, not sadness — one of the most-used reaction emojis online.",
    emotionalMeaning: "Amusement, disbelief at something hilarious.",
    usage: "Reply to jokes, memes, funny videos, or absurd situations.",
    whenToUse: "Casual chat when something is genuinely funny.",
    whenNotToUse: "Sensitive topics where laughter could seem dismissive.",
    context: "Memes, group chats, comment sections",
    interpretations: ["LOL", "I'm dead", "too funny"],
    examples: ["I can't 😂", "Why is this so accurate 😂", "😂😂😂"],
    relatedConcepts: ["laughing", "meme", "humor"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F44D",
    slug: "thumbs-up",
    contentTier: "rich",
    summary: "Approval, agreement, or 'got it'.",
    literalMeaning: "An upward-pointing thumb.",
    meaning:
      "EmojiQuick editorial: OK, yes, good job, or acknowledgment — tone varies by culture and platform.",
    emotionalMeaning: "Neutral-positive confirmation.",
    usage: "Quick replies in work chat, confirming plans, or casual approval.",
    whenToUse: "Async messaging when a full sentence isn't needed.",
    whenNotToUse: "Some cultures find thumbs-up rude; avoid if unsure.",
    context: "WhatsApp, Slack, texting",
    interpretations: ["OK", "approved", "sounds good"],
    examples: ["👍 see you at 3", "👍 thanks", "Nice work 👍"],
    relatedConcepts: ["approval", "agreement"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F389",
    slug: "party-popper",
    contentTier: "rich",
    summary: "Celebration, congratulations, and party energy.",
    literalMeaning: "A party popper releasing confetti.",
    meaning:
      "EmojiQuick editorial: Birthdays, wins, promotions, and any milestone worth celebrating.",
    emotionalMeaning: "Joy, excitement, shared celebration.",
    usage: "Congratulate someone, announce good news, or mark festive occasions.",
    whenToUse: "Birthdays, graduations, new jobs, team wins.",
    whenNotToUse: "Somber announcements where festivity would feel wrong.",
    context: "Birthday messages, social posts",
    interpretations: ["congrats", "celebrate", "party"],
    examples: ["Happy birthday! 🎉", "You did it! 🎉", "Welcome to the team 🎉"],
    relatedConcepts: ["celebration", "birthday", "congratulations"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F480",
    slug: "skull",
    contentTier: "rich",
    summary: "Death humor, danger warnings, or edgy memes.",
    literalMeaning: "A human skull.",
    meaning:
      "EmojiQuick editorial: Often playful — 'I'm dead' from laughter, spooky themes, or caution — rarely literal death.",
    emotionalMeaning: "Dark humor, shock, or Halloween vibes.",
    usage: "React to hilarious messages, Halloween posts, or gaming defeat.",
    whenToUse: "Memes, horror themes, self-deprecating humor among friends.",
    whenNotToUse: "Grief, condolences, or serious health discussions.",
    context: "Memes, gaming, Halloween",
    interpretations: ["I'm dead (laughing)", "spooky", "danger", "RIP humor"],
    misunderstandings: ["Can feel insensitive after real loss — read the room."],
    examples: ["That joke 💀", "Spooky season 💀", "I can't 💀💀"],
    relatedConcepts: ["humor", "Halloween", "memes"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:2728",
    slug: "sparkles",
    contentTier: "rich",
    summary: "Magic, cleanliness, newness, or emphasis.",
    literalMeaning: "Small shining stars or glints.",
    meaning:
      "EmojiQuick editorial: Adds polish — new products, glow-ups, compliments, or ✨ aesthetic ✨ captions.",
    emotionalMeaning: "Delight, emphasis, or whimsical flair.",
    usage: "Highlight something special, celebrate upgrades, or decorate short messages.",
    whenToUse: "Compliments, launches, before/after posts, cute emphasis.",
    whenNotToUse: "Formal reports where decorative symbols look unprofessional.",
    context: "Instagram captions, TikTok, texting",
    interpretations: ["magic", "new", "clean", "special", "aesthetic"],
    examples: ["✨ fresh start ✨", "You look amazing ✨", "New drop ✨"],
    relatedConcepts: ["emphasis", "beauty", "newness"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F600",
    slug: "grinning-face",
    contentTier: "rich",
    summary: "Broad happiness, greetings, or friendly tone.",
    literalMeaning: "A face with a wide open-mouth smile.",
    meaning:
      "EmojiQuick editorial: General positivity — less intense than 😂, warmer than a plain 🙂.",
    emotionalMeaning: "Cheerfulness, openness, light excitement.",
    usage: "Say hi, share good news, or soften a short reply.",
    whenToUse: "Casual chats, friendly openings, low-stakes positivity.",
    whenNotToUse: "Serious apologies or sensitive topics where a big grin may seem dismissive.",
    context: "Texting, social comments",
    interpretations: ["happy", "friendly", "excited", "hi"],
    examples: ["Good morning 😀", "Great news 😀", "See you soon 😀"],
    relatedConcepts: ["happiness", "greeting"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F622",
    slug: "crying-face",
    contentTier: "rich",
    summary: "Sadness, disappointment, or sympathetic empathy.",
    literalMeaning: "A face with a single tear.",
    meaning:
      "EmojiQuick editorial: Mild-to-moderate upset — not always full sobbing; sometimes playful sad.",
    emotionalMeaning: "Hurt feelings, regret, or 'that's so sad'.",
    usage: "Express disappointment, empathize, or react to bad news.",
    whenToUse: "Personal setbacks, sympathetic replies, mild frustration.",
    whenNotToUse: "Mocking someone's real pain or crisis situations.",
    context: "Texting, comments",
    interpretations: ["sad", "disappointed", "aww", "sympathy"],
    misunderstandings: ["A single tear can still read as genuine distress — tone depends on context."],
    examples: ["I missed the bus 😢", "That's rough 😢", "Sorry that happened 😢"],
    relatedConcepts: ["sadness", "empathy"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F64F",
    slug: "folded-hands",
    contentTier: "rich",
    summary: "Thanks, please, prayer, or hopeful request.",
    literalMeaning: "Two hands pressed together palm-to-palm.",
    meaning:
      "EmojiQuick editorial: Gratitude and polite asks are most common in Western texting; prayer or namaste in other contexts.",
    emotionalMeaning: "Gratitude, hope, respect, or earnestness.",
    usage: "Thank someone, ask politely, or show support.",
    whenToUse: "Thanks, please help, good luck wishes, respectful gestures.",
    whenNotToUse: "Situations where religious/prayer symbolism could misread intent across cultures.",
    context: "WhatsApp, texting, social comments",
    interpretations: ["thank you", "please", "prayer", "hope", "respect"],
    misunderstandings: ["Meaning varies by culture — gratitude vs prayer vs greeting."],
    examples: ["Thank you 🙏", "Please 🙏", "Good luck 🙏"],
    relatedConcepts: ["gratitude", "request", "support"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F60D",
    slug: "smiling-face-with-heart-eyes",
    contentTier: "rich",
    summary: "Admiration, crush energy, or loving appreciation.",
    literalMeaning: "A smiling face with heart-shaped eyes.",
    meaning:
      "EmojiQuick editorial: Strong affection or admiration — crushes, compliments, or fandom love.",
    emotionalMeaning: "Warm infatuation, delight in someone or something.",
    usage: "Flirty messages, complimenting a partner, or reacting to something adorable.",
    whenToUse: "Romantic or affectionate contexts where hearts-in-eyes fits naturally.",
    whenNotToUse: "Formal work threads or messages where romantic tone would misread.",
    context: "Dating apps, Instagram comments, texting",
    interpretations: ["in love", "crush", "adorable", "obsessed (playfully)"],
    misunderstandings: ["Can read as romantic even when you mean platonic admiration."],
    examples: ["You're amazing 😍", "This puppy 😍😍", "Love this for you 😍"],
    relatedConcepts: ["romance", "admiration", "affection"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F4AF",
    slug: "hundred-points",
    contentTier: "rich",
    summary: "Perfect score, maximum effort, or full approval.",
    literalMeaning: "The number 100 underlined — a perfect grade symbol.",
    meaning:
      "EmojiQuick editorial: Something is flawless, on point, or deserves top marks — often paired with 🔥.",
    emotionalMeaning: "Pride, hype, or emphatic agreement.",
    usage: "Celebrate wins, validate great work, or react to impressive content.",
    whenToUse: "Achievements, sports highlights, cooking wins, or 'you nailed it' moments.",
    whenNotToUse: "Serious criticism contexts where 💯 may feel dismissive of nuance.",
    context: "Social media, group chats, gaming",
    interpretations: ["100%", "perfect", "on point", "keep it up"],
    examples: ["That presentation 💯", "You ate 💯", "🔥💯"],
    relatedConcepts: ["excellence", "achievement", "hype"],
    provenance: complete,
  });

  registerMeaning({
    ...base,
    canonicalId: "unicode:1F97A",
    slug: "pleading-face",
    contentTier: "rich",
    summary: "Puppy-dog eyes — please, sorry, or gentle begging.",
    literalMeaning: "A face with large pleading eyes and raised brows.",
    meaning:
      "EmojiQuick editorial: Soft asks, apologies, or 'please don't be mad' energy — not aggressive guilt.",
    emotionalMeaning: "Vulnerability, hope, or playful persuasion.",
    usage: "Ask for a favor, apologize lightly, or soften a request.",
    whenToUse: "Casual apologies, asking a friend for help, cute persuasion.",
    whenNotToUse: "Serious accountability conversations where emoji may seem insincere.",
    context: "Texting, memes, social comments",
    interpretations: ["please", "sorry", "can I?", "puppy eyes"],
    misunderstandings: ["Can feel manipulative if overused in real conflicts."],
    examples: ["Can we talk? 🥺", "I'm sorry 🥺", "Please? 🥺"],
    relatedConcepts: ["apology", "request", "empathy"],
    provenance: complete,
  });
}
