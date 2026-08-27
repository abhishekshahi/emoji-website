import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import type { KaomojiRankingItem, KaomojiRankingResult } from "@/lib/kaomoji/rankings/types";

interface KaomojiRankingSectionProps {
  readonly result: KaomojiRankingResult;
  readonly showRank?: boolean;
  readonly headingId?: string;
}

export function KaomojiRankingSection({
  result,
  showRank = true,
  headingId = "kaomoji-ranking-heading",
}: KaomojiRankingSectionProps) {
  if (result.items.length === 0) return null;

  return (
    <section className="space-y-4 max-w-4xl mx-auto" aria-labelledby={headingId}>
      <div className="space-y-1">
        <h2 id={headingId} className="text-lg font-semibold">
          {result.label}
        </h2>
        <p className="text-sm text-muted">{result.description}</p>
        {result.status === "INSUFFICIENT_DATA" ? (
          <p className="text-xs text-muted">
            Live activity: {result.totalEvents.toLocaleString()} events recorded (minimum{" "}
            {result.minimumRequired.toLocaleString()} required for popularity rankings).
          </p>
        ) : null}
      </div>
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3 list-none p-0 m-0">
        {result.items.map((item) => (
          <li key={item.canonical_id} className="relative">
            {showRank ? (
              <span
                className="absolute left-2 top-2 z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface border border-border text-xs font-semibold"
                aria-label={`Rank ${item.rank}`}
              >
                {item.rank}
              </span>
            ) : null}
            <KaomojiCard item={toCard(item)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function toCard(item: KaomojiRankingItem) {
  return {
    canonical_id: item.canonical_id,
    slug: item.slug,
    content: item.content,
    name: item.name,
    accessible_name: item.accessible_name,
  };
}
