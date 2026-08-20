"use client";

export const KAOMOJI_FAVORITES_KEY = "emojiquick-kaomoji-favorites";
export const KAOMOJI_RECENT_KEY = "emojiquick-kaomoji-recent";
export const MAX_KAOMOJI_RECENT = 40;

export function readKaomojiIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeKaomojiIds(key: string, ids: string[]): void {
  localStorage.setItem(key, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("kaomoji-storage", { detail: { key } }));
}

export function toggleKaomojiFavorite(canonicalId: string): boolean {
  const cur = readKaomojiIds(KAOMOJI_FAVORITES_KEY);
  const next = cur.includes(canonicalId) ? cur.filter((x) => x !== canonicalId) : [canonicalId, ...cur];
  writeKaomojiIds(KAOMOJI_FAVORITES_KEY, next);
  return !cur.includes(canonicalId);
}

export function addRecentKaomoji(canonicalId: string): void {
  const cur = readKaomojiIds(KAOMOJI_RECENT_KEY);
  const next = [canonicalId, ...cur.filter((x) => x !== canonicalId)].slice(0, MAX_KAOMOJI_RECENT);
  writeKaomojiIds(KAOMOJI_RECENT_KEY, next);
}
