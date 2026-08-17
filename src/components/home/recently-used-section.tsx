"use client";

import { useEmojiActions } from "@/components/providers/emoji-actions-provider";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { SectionHeader } from "@/components/ui/section-header";
import { getEmojisByHexcodes } from "@/lib/emoji/data";
import { useMemo } from "react";

export function RecentlyUsedSection() {
  const { recent } = useEmojiActions();
  const emojis = useMemo(
    () => getEmojisByHexcodes(recent).slice(0, 12),
    [recent],
  );

  if (recent.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Recently used"
        description="Pick up where you left off."
        action={{ href: "/recent", label: "View all" }}
      />
      <EmojiGrid emojis={emojis} pageSize={12} />
    </section>
  );
}
