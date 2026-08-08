"use client";

import { useMemo } from "react";
import { useEmojiActions } from "@/components/providers/emoji-actions-provider";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { getEmojisByHexcodes } from "@/lib/emoji/data";

interface StoredEmojiGridProps {
  hexcodes: readonly string[];
  emptyTitle: string;
  emptyDescription: string;
}

export function StoredEmojiGrid({
  hexcodes,
  emptyTitle,
  emptyDescription,
}: StoredEmojiGridProps) {
  const emojis = useMemo(() => getEmojisByHexcodes(hexcodes), [hexcodes]);

  if (hexcodes.length === 0) {
    return (
      <div className="card-surface px-6 py-12 text-center">
        <p className="text-lg font-semibold">{emptyTitle}</p>
        <p className="mt-2 text-sm text-muted">{emptyDescription}</p>
      </div>
    );
  }

  return <EmojiGrid emojis={emojis} />;
}

export function FavoritesGrid() {
  const { favorites } = useEmojiActions();

  return (
    <StoredEmojiGrid
      hexcodes={favorites}
      emptyTitle="No favorites yet"
      emptyDescription="Tap the star on any emoji card to save it here."
    />
  );
}

export function RecentGrid() {
  const { recent } = useEmojiActions();

  return (
    <StoredEmojiGrid
      hexcodes={recent}
      emptyTitle="No recent emojis yet"
      emptyDescription="Copy or view emojis and they will appear here."
    />
  );
}
