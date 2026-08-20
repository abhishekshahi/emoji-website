import type { DiscoveryResponse } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 32;

interface CacheEntry {
  readonly response: DiscoveryResponse;
  readonly expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function pruneCache(): void {
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < oldest.length - MAX_CACHE_ENTRIES; i++) {
      cache.delete(oldest[i]![0]);
    }
  }
}

export function getCachedDiscovery(key: string): DiscoveryResponse | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return Object.freeze({ ...entry.response, cached: true });
}

export function setCachedDiscovery(key: string, response: DiscoveryResponse): void {
  pruneCache();
  cache.set(key, {
    response: Object.freeze({ ...response, cached: false }),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function resetDiscoveryCache(): void {
  cache.clear();
}
