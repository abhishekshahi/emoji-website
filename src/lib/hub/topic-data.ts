import { getAllEmojis } from "@/lib/emoji/data";
import type { EmojiRecord } from "@/lib/emoji/types";
import { TOPIC_SLUGS, type TopicSlug } from "./hub-routes";

export interface TopicDefinition {
  readonly title: string;
  readonly emoji: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

export const TOPIC_DEFINITIONS: Record<TopicSlug, TopicDefinition> = {
  hearts: { title: "Hearts", emoji: "❤️", description: "Heart and love symbol emojis.", keywords: ["heart", "love"] },
  faces: { title: "Faces", emoji: "😀", description: "Smileys and face emojis.", keywords: ["face", "smile"] },
  hands: { title: "Hands", emoji: "👋", description: "Hand gesture emojis.", keywords: ["hand", "wave", "thumbs"] },
  people: { title: "People", emoji: "🧑", description: "People and body emojis.", keywords: ["person", "people", "man", "woman"] },
  animals: { title: "Animals", emoji: "🐶", description: "Animal emojis.", keywords: ["animal", "dog", "cat", "bird"] },
  food: { title: "Food", emoji: "🍕", description: "Food emojis.", keywords: ["food", "fruit", "vegetable"] },
  drink: { title: "Drink", emoji: "☕", description: "Drink emojis.", keywords: ["drink", "coffee", "tea", "wine"] },
  nature: { title: "Nature", emoji: "🌿", description: "Nature and plant emojis.", keywords: ["nature", "plant", "tree", "flower"] },
  vehicles: { title: "Vehicles", emoji: "🚗", description: "Transport and vehicle emojis.", keywords: ["car", "vehicle", "train", "plane"] },
  celebration: { title: "Celebration", emoji: "🎉", description: "Party and celebration emojis.", keywords: ["party", "celebration", "birthday"] },
  technology: { title: "Technology", emoji: "💻", description: "Tech and device emojis.", keywords: ["computer", "phone", "tech"] },
  sport: { title: "Sport", emoji: "⚽", description: "Sports emojis.", keywords: ["sport", "ball", "game"] },
  weather: { title: "Weather", emoji: "☀️", description: "Weather emojis.", keywords: ["weather", "sun", "rain", "cloud"] },
  music: { title: "Music", emoji: "🎵", description: "Music emojis.", keywords: ["music", "note", "instrument"] },
  office: { title: "Office", emoji: "📎", description: "Office and work emojis.", keywords: ["office", "work", "paper"] },
  love: { title: "Love", emoji: "💕", description: "Romantic and affection emojis.", keywords: ["love", "kiss", "heart"] },
  gestures: { title: "Gestures", emoji: "👍", description: "Gesture emojis.", keywords: ["gesture", "ok", "point"] },
  plants: { title: "Plants", emoji: "🌱", description: "Plant emojis.", keywords: ["plant", "leaf", "herb"] },
  marine: { title: "Marine", emoji: "🐠", description: "Ocean and marine emojis.", keywords: ["fish", "ocean", "whale"] },
  "gaming-themes": { title: "Gaming", emoji: "🎮", description: "Gaming emojis.", keywords: ["game", "gaming", "controller"] },
};

function matchesTopic(emoji: EmojiRecord, topic: TopicSlug): boolean {
  const def = TOPIC_DEFINITIONS[topic];
  const hay = `${emoji.slug} ${emoji.name} ${emoji.category} ${emoji.subcategory}`.toLowerCase();
  return def.keywords.some((kw) => hay.includes(kw));
}

export function getTopicEmojis(topic: TopicSlug): EmojiRecord[] {
  if (!TOPIC_SLUGS.includes(topic)) return [];
  return getAllEmojis().filter((e) => matchesTopic(e, topic)).slice(0, 120);
}
