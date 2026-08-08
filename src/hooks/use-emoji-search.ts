"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmojiRecord } from "@/lib/emoji/types";
import { searchEmojis } from "@/lib/emoji/search";

let emojiCache: EmojiRecord[] | null = null;

async function loadEmojis(): Promise<EmojiRecord[]> {
  if (emojiCache) {
    return emojiCache;
  }

  const emojiModule = await import("@/data/emojis.json");
  emojiCache = emojiModule.default as EmojiRecord[];
  return emojiCache;
}

export function useEmojiSearch(query: string, limit = 120) {
  const [emojis, setEmojis] = useState<EmojiRecord[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadEmojis().then((data) => {
      if (!cancelled) {
        setEmojis(data);
        setIsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (!isReady || !query.trim()) {
      return [];
    }

    return searchEmojis(emojis, query, limit);
  }, [emojis, isReady, limit, query]);

  return { results, isReady };
}

export function useEmojiDataset() {
  const [emojis, setEmojis] = useState<EmojiRecord[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadEmojis().then((data) => {
      if (!cancelled) {
        setEmojis(data);
        setIsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { emojis, isReady };
}
