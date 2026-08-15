"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowsableEmoji, EmojiRecord } from "@/lib/emoji/types";
import { searchEmojis } from "@/lib/emoji/search";
import { SEARCH_UI_CONTRACT } from "@/lib/emoji/search-ui-contract";

let emojiCache: BrowsableEmoji[] | null = null;
let searchEnrichmentCache: Readonly<Record<string, readonly string[]>> | null = null;

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

async function loadSearchEnrichment(): Promise<Readonly<Record<string, readonly string[]>>> {
  if (searchEnrichmentCache) {
    return searchEnrichmentCache;
  }

  const module = await import("@/data/emoji-search-enrichment.json");
  searchEnrichmentCache = (module.default as { byId: Record<string, readonly string[]> }).byId;
  return searchEnrichmentCache;
}

export function useEmojiSearch(query: string, limit = 120) {
  const [emojis, setEmojis] = useState<BrowsableEmoji[]>([]);
  const [searchEnrichment, setSearchEnrichment] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [isReady, setIsReady] = useState(false);
  const latestQueryRef = useRef(query);

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadEmojis(), loadSearchEnrichment()]).then(([data, enrichment]) => {
      if (!cancelled) {
        setEmojis(data);
        setSearchEnrichment(enrichment);
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

    if (emojis.length > SEARCH_UI_CONTRACT.maxClientEmojiRecords) {
      return [];
    }

    return searchEmojis(emojis, query, limit, searchEnrichment);
  }, [emojis, isReady, limit, query, searchEnrichment]);

  const stableResults = latestQueryRef.current === query ? results : [];

  return { results: stableResults, isReady };
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
