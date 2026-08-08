"use client";

import Link from "next/link";
import { useEmojiActions } from "@/components/providers/emoji-actions-provider";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { getEmojisByHexcodes } from "@/lib/emoji/data";
import { useMemo } from "react";

export function RecentlyUsedSection() {
  const { recent } = useEmojiActions();
  const emojis = useMemo(
    () => getEmojisByHexcodes([...recent]).slice(0, 12),
    [recent],
  );

  if (recent.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="section-title">Recently Used</h2>
          <p className="section-subtitle">Pick up where you left off.</p>
        </div>
        <Link href="/recent" className="pill-link">
          View all
        </Link>
      </div>
      <EmojiGrid emojis={emojis} pageSize={12} />
    </section>
  );
}
