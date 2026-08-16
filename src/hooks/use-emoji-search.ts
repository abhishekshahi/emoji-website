"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrowsableEmoji, EmojiRecord } from "@/lib/emoji/types";
import { fetchMasterSearch, mapMasterSearchResultToBrowsable } from "@/lib/emoji/master-search-client";
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
  const [masterResults, setMasterResults] = useState<Array<{ emoji: BrowsableEmoji; score: number }>>([]);
  const [isReady, setIsReady] = useState(false);
  const [usesMasterSearch, setUsesMasterSearch] = useState(false);
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

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setMasterResults([]);
      setUsesMasterSearch(false);
      return;
    }

    let cancelled = false;
    setUsesMasterSearch(true);

    fetchMasterSearch(trimmed, limit).then((response) => {
      if (cancelled) return;
      if (!response) {
        setUsesMasterSearch(false);
        setMasterResults([]);
        return;
      }

      const mapped = response.results
        .map((result) => {
          const emoji = mapMasterSearchResultToBrowsable(result);
          if (!emoji) return null;
          return { emoji, score: result.score };
        })
        .filter((entry): entry is { emoji: BrowsableEmoji; score: number } => Boolean(entry));

      setMasterResults(mapped);
    });

    return () => {
      cancelled = true;
    };
  }, [limit, query]);

  const clientResults = useMemo(() => {
    if (!isReady || !query.trim() || usesMasterSearch) {
      return [];
    }

    if (emojis.length > SEARCH_UI_CONTRACT.maxClientEmojiRecords) {
      return [];
    }

    return searchEmojis(emojis, query, limit, searchEnrichment);
  }, [emojis, isReady, limit, query, searchEnrichment, usesMasterSearch]);

  const results = usesMasterSearch ? masterResults : clientResults;
  const stableResults = latestQueryRef.current === query ? results : [];

  return { results: stableResults, isReady: isReady || usesMasterSearch };
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
