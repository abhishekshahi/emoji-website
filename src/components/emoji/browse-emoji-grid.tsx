"use client";

import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { useEmojiDataset } from "@/hooks/use-emoji-search";

export function BrowseEmojiGrid() {
  const { emojis, isReady } = useEmojiDataset();

  if (!isReady) {
    return (
      <div className="card-surface px-6 py-12 text-center text-muted">
        Loading emoji collection...
      </div>
    );
  }

  return <EmojiGrid emojis={emojis} />;
}
