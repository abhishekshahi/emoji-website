"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { getEmojiBySlug } from "@/lib/emoji/data";
import type { EmojiRecord } from "@/lib/emoji/types";
import type { DiscoveryContext, DiscoveryPeriod, PopularSort } from "@/lib/discovery/types";

type Tab = "trending" | "popular" | "context";

const TRENDING_PERIODS: { value: DiscoveryPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const POPULAR_SORTS: { value: PopularSort; label: string }[] = [
  { value: "copied", label: "Copied" },
  { value: "searched", label: "Searched" },
  { value: "saved", label: "Saved" },
  { value: "viewed", label: "Viewed" },
];

const CONTEXTS: { value: DiscoveryContext; label: string; icon: string }[] = [
  { value: "instagram", label: "Instagram", icon: "📸" },
  { value: "discord", label: "Discord", icon: "💬" },
  { value: "tiktok", label: "TikTok", icon: "🎵" },
  { value: "whatsapp", label: "WhatsApp", icon: "💚" },
  { value: "x", label: "X", icon: "𝕏" },
  { value: "gaming", label: "Gaming", icon: "🎮" },
  { value: "work", label: "Work", icon: "💼" },
];

interface DiscoveryItem {
  slug: string;
  name: string;
  emoji: string;
}

export function DiscoverySection() {
  const [tab, setTab] = useState<Tab>("trending");
  const [period, setPeriod] = useState<DiscoveryPeriod>("today");
  const [sort, setSort] = useState<PopularSort>("copied");
  const [context, setContext] = useState<DiscoveryContext>("instagram");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [label, setLabel] = useState("Trending Today");
  const [source, setSource] = useState("baseline");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const url =
      tab === "trending"
        ? `/api/discovery/trending?period=${period}`
        : tab === "popular"
          ? `/api/discovery/popular?sort=${sort}`
          : `/api/discovery/context/${context}`;

    fetch(url)
      .then((res) => res.json())
      .then((data: { label: string; source: string; items: DiscoveryItem[] }) => {
        if (!cancelled) {
          setItems(data.items ?? []);
          setLabel(data.label ?? "");
          setSource(data.source ?? "baseline");
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, period, sort, context]);

  const emojis = useMemo(
    () =>
      items
        .map((item) => getEmojiBySlug(item.slug))
        .filter((e): e is EmojiRecord => Boolean(e)),
    [items],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="section-title">Discover Emojis</h2>
          <p className="section-subtitle">
            {label}
            {source === "baseline" ? " · editorial baseline" : ""}
          </p>
        </div>
        <Link href="/popular" className="pill-link">
          View all popular
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Discovery views">
        {(["trending", "popular", "context"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-accent text-on-accent"
                : "bg-surface-muted text-muted hover:text-foreground"
            }`}
          >
            {t === "trending" ? "Trending" : t === "popular" ? "Popular" : "By Context"}
          </button>
        ))}
      </div>

      {tab === "trending" && (
        <div className="flex flex-wrap gap-2">
          {TRENDING_PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                period === p.value
                  ? "bg-accent-soft text-accent-strong"
                  : "text-muted hover:bg-surface-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {tab === "popular" && (
        <div className="flex flex-wrap gap-2">
          {POPULAR_SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSort(s.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                sort === s.value
                  ? "bg-accent-soft text-accent-strong"
                  : "text-muted hover:bg-surface-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {tab === "context" && (
        <div className="flex flex-wrap gap-2">
          {CONTEXTS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setContext(c.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                context === c.value
                  ? "bg-accent-soft text-accent-strong"
                  : "text-muted hover:bg-surface-muted"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card-surface px-6 py-12 text-center text-muted" role="status" aria-busy="true">
          Loading discovery…
        </div>
      ) : (
        <EmojiGrid emojis={emojis} pageSize={12} emptyMessage="No emojis found for this discovery view." />
      )}
    </section>
  );
}
