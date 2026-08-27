import type { EventGuide, EventTimingDisplay } from "./types";
import {
  currentUtcYear,
  daysUntilMonthDay,
  formatUtcMonthDay,
  isWithinSeason,
  usThanksgivingDate,
} from "./dates";

export const EVENT_PAGE_SLUGS = [
  "new-year",
  "valentines-day",
  "halloween",
  "christmas",
  "thanksgiving",
  "birthday",
  "wedding",
  "graduation",
  "anniversary",
  "congratulations",
  "good-luck",
  "thank-you",
] as const;

export type EventPageSlug = (typeof EVENT_PAGE_SLUGS)[number];

const SLUG_SET = new Set<string>(EVENT_PAGE_SLUGS);

export const MIN_EVENT_PAGE_ITEMS = 6 as const;

const EVENTS: Record<EventPageSlug, EventGuide> = {
  "new-year": {
    slug: "new-year",
    kind: "seasonal",
    title: "New Year Kaomoji — Copy Text Faces for New Year Messages",
    h1: "New year kaomoji",
    description: "Copy kaomoji for New Year greetings and fresh-start messages. Festive and hopeful text faces.",
    intro:
      "New Year messages often mix celebration with hope for the year ahead. Kaomoji add a friendly, personal touch to texts, group chats, and social posts when plain emoji feel too generic.",
    usage:
      "Use upbeat happy or excited faces for countdown posts and morning greetings. Keep messages short for SMS; decorative kaomoji work well on social captions.",
    context:
      "New Year's Day is widely observed on January 1 in the Gregorian calendar. Regional traditions vary; these kaomoji focus on general celebration rather than a specific culture's customs.",
    searchQuery: "happy new year celebration",
    categorySlugs: ["happy", "excited", "greeting"],
    intentSlugs: ["happy", "love"],
    collectionSlug: "happy-kaomoji",
    relatedEventSlugs: ["christmas", "congratulations", "good-luck"],
    timingKind: "fixed",
    fixedMonth: 1,
    fixedDay: 1,
    seasonStartMonth: 12,
    seasonStartDay: 26,
    seasonEndMonth: 1,
    seasonEndDay: 7,
  },
  "valentines-day": {
    slug: "valentines-day",
    kind: "seasonal",
    title: "Valentine's Day Kaomoji — Love Text Faces to Copy",
    h1: "Valentine's Day kaomoji",
    description: "Romantic and cute kaomoji for Valentine's Day messages. Copy love text faces for partners and friends.",
    intro:
      "Valentine's Day messages range from romantic notes to friendly appreciation. Love and cute kaomoji help convey warmth in chats, cards, and captions.",
    usage:
      "Heart-forward faces suit partners; shy or cute styles work for new relationships and friends. Match tone to your relationship.",
    context:
      "Valentine's Day is commonly observed on February 14 in many countries as a day to express affection. Traditions differ by region.",
    searchQuery: "love romantic heart",
    categorySlugs: ["love", "romantic", "kiss", "cute"],
    intentSlugs: ["love", "cute", "hug"],
    collectionSlug: "love-kaomoji",
    relatedEventSlugs: ["anniversary", "wedding", "thank-you"],
    timingKind: "fixed",
    fixedMonth: 2,
    fixedDay: 14,
    seasonStartMonth: 2,
    seasonStartDay: 1,
    seasonEndMonth: 2,
    seasonEndDay: 15,
  },
  halloween: {
    slug: "halloween",
    kind: "seasonal",
    title: "Halloween Kaomoji — Spooky & Cute Text Faces",
    h1: "Halloween kaomoji",
    description: "Copy Halloween kaomoji for spooky, cute, and playful October messages.",
    intro:
      "Halloween chats mix spooky humor with cute reactions. Kaomoji can feel playful rather than frightening — ideal for friends and family group chats.",
    usage:
      "Funny and shocked faces fit memes and party plans; cute styles work for kid-friendly messages. Test readability on dark-mode apps.",
    context:
      "Halloween is widely associated with October 31 in North America and increasingly elsewhere, often with costumes and lighthearted scares.",
    searchQuery: "funny spooky ghost",
    categorySlugs: ["funny", "shocked", "scared", "cute"],
    intentSlugs: ["funny", "cat"],
    collectionSlug: "funny-kaomoji",
    relatedEventSlugs: ["christmas", "birthday"],
    timingKind: "fixed",
    fixedMonth: 10,
    fixedDay: 31,
    seasonStartMonth: 10,
    seasonStartDay: 1,
    seasonEndMonth: 11,
    seasonEndDay: 2,
  },
  christmas: {
    slug: "christmas",
    kind: "seasonal",
    title: "Christmas Kaomoji — Festive Text Faces to Copy",
    h1: "Christmas kaomoji",
    description: "Festive kaomoji for Christmas greetings and holiday chats. Copy cheerful text faces.",
    intro:
      "Holiday messages benefit from warm, happy kaomoji — for family group chats, thank-you notes, and seasonal social posts.",
    usage:
      "Happy and cute faces are safe defaults. Keep messages inclusive if recipients celebrate differently or not at all.",
    context:
      "Christmas is observed on December 25 by many Christian communities and is also a broader cultural holiday season in several countries.",
    searchQuery: "happy cute celebration",
    categorySlugs: ["happy", "cute", "love", "greeting"],
    intentSlugs: ["happy", "cute", "love"],
    collectionSlug: "cute-kaomoji",
    relatedEventSlugs: ["new-year", "thank-you"],
    timingKind: "fixed",
    fixedMonth: 12,
    fixedDay: 25,
    seasonStartMonth: 12,
    seasonStartDay: 1,
    seasonEndMonth: 12,
    seasonEndDay: 26,
  },
  thanksgiving: {
    slug: "thanksgiving",
    kind: "seasonal",
    title: "Thanksgiving Kaomoji — Grateful Text Faces",
    h1: "Thanksgiving kaomoji",
    description: "Copy kaomoji for Thanksgiving gratitude messages and autumn chats.",
    intro:
      "Thanksgiving messages emphasize gratitude and togetherness. Friendly happy and hug-style kaomoji support warm notes to friends and family.",
    usage:
      "Pair kaomoji with a sincere thank-you line. Hug and happy categories fit group chat gratitude threads.",
    context:
      "Thanksgiving in the United States is observed on the fourth Thursday of November. Other countries have separate harvest or thanksgiving traditions.",
    searchQuery: "thank happy hug",
    categorySlugs: ["thank-you", "happy", "hug", "friendship"],
    intentSlugs: ["happy", "hug", "friendship"],
    collectionSlug: "kaomoji-for-friendship",
    relatedEventSlugs: ["thank-you", "christmas"],
    timingKind: "movable_us",
    seasonStartMonth: 11,
    seasonStartDay: 1,
    seasonEndMonth: 11,
    seasonEndDay: 30,
  },
  birthday: {
    slug: "birthday",
    kind: "evergreen",
    title: "Birthday Kaomoji — Celebration Text Faces",
    h1: "Birthday kaomoji",
    description: "Copy birthday kaomoji for celebration messages all year. Happy and cute text faces.",
    intro:
      "Birthday messages are evergreen — group chats, cards, and social posts year-round. Festive happy kaomoji add personality beyond plain emoji.",
    usage:
      "Lead with the person's name and a short wish; add one kaomoji rather than a wall of faces. Happy and excited styles fit most ages.",
    context: "Birthdays are personal anniversaries; no fixed calendar date applies globally.",
    searchQuery: "happy celebration excited",
    categorySlugs: ["happy", "excited", "cute"],
    intentSlugs: ["happy", "cute", "love"],
    collectionSlug: "happy-kaomoji",
    relatedEventSlugs: ["congratulations", "thank-you", "good-luck"],
    timingKind: "none",
  },
  wedding: {
    slug: "wedding",
    kind: "evergreen",
    title: "Wedding Kaomoji — Romantic Celebration Text Faces",
    h1: "Wedding kaomoji",
    description: "Copy kaomoji for wedding congratulations and romantic celebration messages.",
    intro:
      "Wedding messages combine congratulations with warmth. Love, romantic, and happy kaomoji suit cards, chats, and social comments.",
    usage:
      "Keep tone respectful for formal couples; playful cute faces may fit close friends. One or two kaomoji per message is enough.",
    context: "Wedding customs vary widely by culture and religion; these faces focus on general celebration.",
    searchQuery: "love romantic happy",
    categorySlugs: ["love", "romantic", "happy", "kiss"],
    intentSlugs: ["love", "happy", "hug"],
    collectionSlug: "kaomoji-for-couples",
    relatedEventSlugs: ["anniversary", "congratulations", "valentines-day"],
    timingKind: "none",
  },
  graduation: {
    slug: "graduation",
    kind: "evergreen",
    title: "Graduation Kaomoji — Proud & Happy Text Faces",
    h1: "Graduation kaomoji",
    description: "Copy graduation kaomoji for proud celebration messages and good-luck notes.",
    intro:
      "Graduation marks achievement and new chapters. Proud, happy, and good-luck kaomoji support encouragement in texts and social posts.",
    usage:
      "Combine a specific congrats line with a happy or excited face. Good-luck styles work for post-graduation next steps.",
    context: "Graduation dates depend on school and region — typically spring or early summer in many countries.",
    searchQuery: "happy proud excited good luck",
    categorySlugs: ["happy", "excited", "proud"],
    intentSlugs: ["happy", "cute"],
    collectionSlug: "happy-kaomoji",
    relatedEventSlugs: ["congratulations", "good-luck"],
    timingKind: "none",
  },
  anniversary: {
    slug: "anniversary",
    kind: "evergreen",
    title: "Anniversary Kaomoji — Love & Celebration Text Faces",
    h1: "Anniversary kaomoji",
    description: "Copy anniversary kaomoji for partners and loved ones. Romantic text faces to celebrate milestones.",
    intro:
      "Anniversary notes celebrate time together — romantic partners, friends, or organizations. Love and happy kaomoji reinforce the sentiment.",
    usage:
      "Romantic faces for partners; warm happy faces for friends and teams. Mention the milestone in text, not only the kaomoji.",
    context: "Anniversaries are tied to a specific relationship start date, not a global calendar holiday.",
    searchQuery: "love romantic happy",
    categorySlugs: ["love", "romantic", "happy"],
    intentSlugs: ["love", "hug"],
    collectionSlug: "love-kaomoji",
    relatedEventSlugs: ["valentines-day", "wedding"],
    timingKind: "none",
  },
  congratulations: {
    slug: "congratulations",
    kind: "evergreen",
    title: "Congratulations Kaomoji — Celebration Text Faces",
    h1: "Congratulations kaomoji",
    description: "Copy congratulations kaomoji for wins, promotions, and milestones.",
    intro:
      "Congratulations messages apply to exams, jobs, sports, and life events. Happy and excited kaomoji amplify the tone without replacing your words.",
    usage:
      "Name the achievement explicitly. Excited faces for big wins; happy faces for everyday good news.",
    context: "Evergreen — suitable any time someone shares good news.",
    searchQuery: "happy excited celebration",
    categorySlugs: ["happy", "excited", "proud"],
    intentSlugs: ["happy", "cute"],
    collectionSlug: "happy-kaomoji",
    relatedEventSlugs: ["graduation", "birthday", "good-luck"],
    timingKind: "none",
  },
  "good-luck": {
    slug: "good-luck",
    kind: "evergreen",
    title: "Good Luck Kaomoji — Supportive Text Faces",
    h1: "Good luck kaomoji",
    description: "Copy good luck kaomoji for exams, interviews, and new beginnings.",
    intro:
      "Good luck messages support someone before a challenge. Encouraging happy and shy kaomoji soften stress and show you care.",
    usage:
      "Send shortly before the event. Avoid sarcastic angry faces; supportive happy or cute styles read best.",
    context: "Evergreen — used before tests, interviews, performances, and travel.",
    searchQuery: "happy shy support",
    categorySlugs: ["happy", "shy", "excited"],
    intentSlugs: ["happy", "shy"],
    collectionSlug: "happy-kaomoji",
    relatedEventSlugs: ["graduation", "congratulations"],
    timingKind: "none",
  },
  "thank-you": {
    slug: "thank-you",
    kind: "evergreen",
    title: "Thank You Kaomoji — Grateful Text Faces",
    h1: "Thank you kaomoji",
    description: "Copy thank you kaomoji for gratitude messages and appreciation notes.",
    intro:
      "Thank-you messages acknowledge help, gifts, or kindness. Warm hug and happy kaomoji reinforce sincerity in chats and comments.",
    usage:
      "Say what you are thanking them for first. Hug-style faces suit close friends; happy faces suit colleagues.",
    context: "Evergreen — appropriate whenever expressing gratitude.",
    searchQuery: "thank happy hug",
    categorySlugs: ["thank-you", "happy", "hug"],
    intentSlugs: ["hug", "happy", "friendship"],
    collectionSlug: "kaomoji-for-friendship",
    relatedEventSlugs: ["thanksgiving", "birthday"],
    timingKind: "none",
  },
};

export function isEventPageSlug(slug: string): slug is EventPageSlug {
  return SLUG_SET.has(slug);
}

export function getEventGuide(slug: string): EventGuide | null {
  if (!isEventPageSlug(slug)) return null;
  return EVENTS[slug];
}

export function listEventGuides(): readonly EventGuide[] {
  return EVENT_PAGE_SLUGS.map((s) => EVENTS[s]);
}

export function getEventTimingDisplay(guide: EventGuide, now = new Date()): EventTimingDisplay | null {
  const year = currentUtcYear(now);
  switch (guide.timingKind) {
    case "fixed":
      if (guide.fixedMonth && guide.fixedDay) {
        return {
          label: "Typical observance",
          detail: `${formatUtcMonthDay(guide.fixedMonth, guide.fixedDay)} (Gregorian calendar). Dates in ${year} follow the same annual pattern.`,
        };
      }
      return null;
    case "movable_us":
      if (guide.slug === "thanksgiving") {
        const d = usThanksgivingDate(year);
        return {
          label: "United States observance",
          detail: `Fourth Thursday of November — ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })} in ${year}.`,
        };
      }
      return null;
    case "lunar_varies":
      return {
        label: "Observance",
        detail: "Date varies each year on the lunar calendar. Check an authoritative calendar for the current year.",
      };
    default:
      return null;
  }
}

export function isEventInSeason(guide: EventGuide, now = new Date()): boolean {
  if (guide.kind === "evergreen") return true;
  if (
    guide.seasonStartMonth &&
    guide.seasonStartDay &&
    guide.seasonEndMonth &&
    guide.seasonEndDay
  ) {
    return isWithinSeason(now, guide.seasonStartMonth, guide.seasonStartDay, guide.seasonEndMonth, guide.seasonEndDay);
  }
  if (guide.fixedMonth && guide.fixedDay) {
    return daysUntilMonthDay(now, guide.fixedMonth, guide.fixedDay) <= 45;
  }
  return false;
}

export function getNearTermEvents(now = new Date(), limit = 4): EventGuide[] {
  const seasonal = listEventGuides().filter((g) => g.kind === "seasonal" && isEventInSeason(g, now));
  seasonal.sort((a, b) => {
    if (!a.fixedMonth || !b.fixedMonth) return 0;
    const da = daysUntilMonthDay(now, a.fixedMonth, a.fixedDay ?? 1);
    const db = daysUntilMonthDay(now, b.fixedMonth, b.fixedDay ?? 1);
    return da - db;
  });
  return seasonal.slice(0, limit);
}

export function buildEventFaq(guide: EventGuide, timing: EventTimingDisplay | null): readonly { question: string; answer: string }[] {
  const faq = [
    {
      question: `What kaomoji fit ${guide.h1}?`,
      answer: guide.usage,
    },
    {
      question: "How do I copy a kaomoji?",
      answer: "Tap Copy on any card. The exact Unicode text is copied — not a link or image.",
    },
  ];
  if (timing) {
    faq.unshift({
      question: `When is ${guide.h1.replace(/ kaomoji$/i, "")} observed?`,
      answer: timing.detail,
    });
  }
  return faq;
}

export function buildEventPagePath(slug: EventPageSlug): string {
  return `/kaomoji/events/${slug}`;
}
