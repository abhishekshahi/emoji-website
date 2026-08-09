"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrowsableEmoji, EmojiRecord } from "@/lib/emoji/types";
import { searchEmojis } from "@/lib/emoji/search";

let emojiCache: BrowsableEmoji[] | null = null;

async function loadEmojis(): Promise<BrowsableEmoji[]> {
  if (emojiCache) {
    return emojiCache;
  }

  const [standardModule, extrasModule] = await Promise.all([
    import("@/data/emojis.json"),
    import("@/data/openmoji-extras.json"),
  ]);

  emojiCache = [
    ...(standardModule.default as BrowsableEmoji[]),
    ...(extrasModule.default as BrowsableEmoji[]),
  ];

  return emojiCache;
}

export function useEmojiSearch(query: string, limit = 120) {
  const [emojis, setEmojis] = useState<BrowsableEmoji[]>([]);
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

    import("@/data/emojis.json").then((emojiModule) => {
      if (!cancelled) {
        setEmojis(emojiModule.default as EmojiRecord[]);
        setIsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { emojis, isReady };
}
