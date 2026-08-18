"use client";

import Link from "next/link";
import { trackClientEvent } from "@/lib/content/analytics/client";
import type { EmojiCombination } from "@/lib/content/combinations/types";

interface GeneratorIntent {
  readonly id: string;
  readonly label: string;
  readonly comboSlug: string;
}

interface GeneratorIntentGridProps {
  readonly intents: readonly GeneratorIntent[];
  readonly combinations: readonly EmojiCombination[];
}

export function GeneratorIntentGrid({ intents, combinations }: GeneratorIntentGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {intents.map((mood) => {
        const combo = combinations.find((c) => c.slug === mood.comboSlug);
        if (!combo) return null;
        const canonicalId = combo.emojiIds[0] ?? "unicode:1F525";
        return (
          <Link
            key={mood.id}
            href={`/combinations/${combo.slug}`}
            className="card-surface flex flex-col gap-2 p-4 transition hover:border-accent"
            onClick={() => trackClientEvent("generator_use", canonicalId, mood.id)}
          >
            <span className="text-2xl" aria-hidden="true">{combo.sequence}</span>
            <span className="font-medium">{mood.label}</span>
            <span className="text-sm text-muted">{combo.meaning}</span>
          </Link>
        );
      })}
    </div>
  );
}
