"use client";

import { useCallback, useState } from "react";
import { KaomojiCard, type KaomojiCardData } from "./kaomoji-card";

export function KaomojiSearchPanel({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<KaomojiCardData[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kaomoji/search?q=${encodeURIComponent(q)}&limit=24`);
      const data = (await res.json()) as { results: KaomojiCardData[] };
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
        className="flex gap-2"
      >
        <input
          className="input flex-1 min-h-11"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cute, love, cat, happy kaomoji…"
          aria-label="Search kaomoji"
        />
        <button type="submit" className="btn btn--primary min-h-11">Search</button>
      </form>
      {loading ? <p className="text-sm text-muted">Searching…</p> : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {results.map((r) => (
          <KaomojiCard key={r.canonical_id} item={r} />
        ))}
      </div>
    </div>
  );
}
