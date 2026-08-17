"use client";

import { useEffect, useMemo, useState } from "react";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { Chip } from "@/components/ui/chip";
import { EmojiGridSkeleton } from "@/components/ui/skeleton";
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
  { value: "copied", label: "Most Copied" },
  { value: "searched", label: "Most Searched" },
  { value: "saved", label: "Most Saved" },
  { value: "viewed", label: "Most Viewed" },
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
      <SectionHeader
        title="Trending now"
        description={
          source === "baseline"
            ? `${label} · editorial baseline`
            : label
        }
        action={{ href: "/trending", label: "View trending" }}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Discovery views">
        {(["trending", "popular", "context"] as Tab[]).map((t) => (
          <Chip
            key={t}
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? "active" : "default"}
            onClick={() => setTab(t)}
          >
            {t === "trending" ? "Trending" : t === "popular" ? "Popular" : "By Context"}
          </Chip>
        ))}
      </div>

      {tab === "trending" && (
        <div className="flex flex-wrap gap-2">
          {TRENDING_PERIODS.map((p) => (
            <Chip
              key={p.value}
              variant={period === p.value ? "soft" : "outline"}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Chip>
          ))}
        </div>
      )}

      {tab === "popular" && (
        <div className="flex flex-wrap gap-2">
          {POPULAR_SORTS.map((s) => (
            <Chip
              key={s.value}
              variant={sort === s.value ? "soft" : "outline"}
              onClick={() => setSort(s.value)}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      )}

      {tab === "context" && (
        <div className="flex flex-wrap gap-2">
          {CONTEXTS.map((c) => (
            <Chip
              key={c.value}
              variant={context === c.value ? "soft" : "outline"}
              onClick={() => setContext(c.value)}
            >
              {c.icon} {c.label}
            </Chip>
          ))}
        </div>
      )}

      {loading ? (
        <EmojiGridSkeleton count={12} />
      ) : (
        <EmojiGrid emojis={emojis} pageSize={12} emptyMessage="No emojis found for this discovery view." />
      )}
    </section>
  );
}
