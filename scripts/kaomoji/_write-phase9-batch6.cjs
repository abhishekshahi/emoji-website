const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
function w(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel);
}

w("src/lib/kaomoji/product/local-storage.ts", `"use client";

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
`);

w("src/components/kaomoji/kaomoji-card.tsx", `"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { copyText } from "@/lib/clipboard/copy-text";
import { addRecentKaomoji, toggleKaomojiFavorite, readKaomojiIds, KAOMOJI_FAVORITES_KEY } from "@/lib/kaomoji/product/local-storage";

export interface KaomojiCardData {
  canonical_id: string;
  slug: string;
  content: string;
  name: string | null;
  accessible_name: string;
}

interface KaomojiCardProps {
  item: KaomojiCardData;
}

export function KaomojiCard({ item }: KaomojiCardProps) {
  const [copied, setCopied] = useState(false);
  const [fav, setFav] = useState(() =>
    typeof window !== "undefined" ? readKaomojiIds(KAOMOJI_FAVORITES_KEY).includes(item.canonical_id) : false,
  );

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(item.content);
    if (ok) {
      addRecentKaomoji(item.canonical_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }, [item.canonical_id, item.content]);

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFav(toggleKaomojiFavorite(item.canonical_id));
  }, [item.canonical_id]);

  return (
    <article className="emoji-card group p-2 sm:p-3">
      <Link href={\`/kaomoji/\${item.slug}\`} className="block space-y-2 text-center" aria-label={item.accessible_name}>
        <div className="text-2xl sm:text-3xl leading-none break-all px-1" aria-hidden="true">{item.content}</div>
        {item.name ? <p className="text-xs text-muted truncate">{item.name}</p> : null}
      </Link>
      <div className="mt-2 flex gap-1 justify-center">
        <button type="button" className="btn btn--secondary btn--sm min-h-9" onClick={handleCopy} aria-label={\`Copy \${item.accessible_name}\`}>
          {copied ? "Copied!" : "Copy"}
        </button>
        <button type="button" className="btn btn--ghost btn--sm min-h-9" onClick={handleFavorite} aria-label={fav ? "Unfavorite" : "Favorite"}>
          {fav ? "★" : "☆"}
        </button>
      </div>
    </article>
  );
}
`);

w("src/components/kaomoji/kaomoji-search-panel.tsx", `"use client";

import { useCallback, useState } from "react";
import { KaomojiCard, type KaomojiCardData } from "./kaomoji-card";

export function KaomojiSearchPanel({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<KaomojiCardData[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(\`/api/kaomoji/search?q=\${encodeURIComponent(q)}&limit=24\`);
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
`);

w("src/app/api/kaomoji/search/route.ts", `import { NextResponse } from "next/server";
import { searchKaomojiPublic } from "@/lib/kaomoji/product/search";
import { phase9DataExists } from "@/lib/kaomoji/product/loader";

export async function GET(request: Request): Promise<NextResponse> {
  if (!phase9DataExists()) {
    return NextResponse.json({ results: [] });
  }
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  const limit = Math.min(48, Math.max(1, Number(url.searchParams.get("limit") ?? 24)));
  if (!q.trim()) return NextResponse.json({ results: [] });
  const hits = searchKaomojiPublic(q, limit);
  return NextResponse.json({
    results: hits.map((h) => ({
      canonical_id: h.record.canonical_id,
      slug: h.record.slug,
      content: h.record.content,
      name: h.record.name,
      accessible_name: h.record.name ? \`\${h.record.name.toLowerCase()} kaomoji\` : "kaomoji expression",
      score: h.score,
    })),
  });
}
`);

w("src/app/kaomoji/page.tsx", `import type { Metadata } from "next";
import Link from "next/link";
import { HubLayout } from "@/components/hub/hub-layout";
import { KaomojiSearchPanel } from "@/components/kaomoji/kaomoji-search-panel";
import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import { getPublicEditorialRecords, loadCollections, phase9DataExists } from "@/lib/kaomoji/product/loader";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Kaomoji — Japanese Text Faces",
  description: "Browse, search, and copy kaomoji text faces. Cute, love, happy, sad, and more.",
  path: "/kaomoji",
});

export default function KaomojiHubPage() {
  if (!phase9DataExists()) {
    return (
      <HubLayout path="/kaomoji" title="Kaomoji" description="Kaomoji dataset not built yet. Run npm run kaomoji:phase9.">
        <p className="text-muted">Phase 9 data required.</p>
      </HubLayout>
    );
  }
  const featured = getPublicEditorialRecords(12);
  const collections = loadCollections().slice(0, 10);
  return (
    <HubLayout
      path="/kaomoji"
      title="Kaomoji"
      description="Search and copy Japanese-style text faces (kaomoji). No account required."
      links={[
        { href: "/kaomoji-content-coverage", label: "Content coverage" },
        { href: "/search", label: "Emoji search" },
      ]}
    >
      <KaomojiSearchPanel />
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Featured</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {featured.map((r) => (
            <KaomojiCard key={r.canonical_id} item={{ canonical_id: r.canonical_id, slug: r.slug, content: r.canonical_content, name: r.editorial_name, accessible_name: r.accessible_name }} />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Collections</h2>
        <ul className="flex flex-wrap gap-2">
          {collections.map((c) => (
            <li key={c.slug}><Link className="chip" href={\`/kaomoji/collections/\${c.slug}\`}>{c.title}</Link></li>
          ))}
        </ul>
      </section>
    </HubLayout>
  );
}
`);

console.log("batch6 ui partial done");
