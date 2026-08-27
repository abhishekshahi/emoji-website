import { KaomojiCard, type KaomojiCardData } from "@/components/kaomoji/kaomoji-card";
import type { RelatedKaomojiHit } from "@/lib/kaomoji/related/types";

interface KaomojiRelatedSectionProps {
  readonly similar?: readonly RelatedKaomojiHit[];
  readonly related?: readonly RelatedKaomojiHit[];
  readonly heading?: string;
  readonly items?: readonly KaomojiCardData[];
}

function hitToCard(hit: RelatedKaomojiHit): KaomojiCardData {
  return {
    canonical_id: hit.canonical_id,
    slug: hit.slug,
    content: hit.content,
    name: hit.name,
    accessible_name: hit.accessible_name,
    reason: hit.reason,
  };
}

function RelatedGrid({
  id,
  heading,
  hits,
}: {
  id: string;
  heading: string;
  hits: readonly KaomojiCardData[];
}) {
  if (hits.length === 0) return null;
  return (
    <section className="space-y-4 max-w-4xl mx-auto" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold">{heading}</h2>
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 list-none p-0 m-0">
        {hits.map((item) => (
          <li key={item.canonical_id}>
            <KaomojiCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function KaomojiRelatedSection({ similar, related, items, heading }: KaomojiRelatedSectionProps) {
  const similarCards = (similar ?? []).map(hitToCard);
  const relatedCards = related ? related.map(hitToCard) : (items ?? []);

  if (similarCards.length === 0 && relatedCards.length === 0) return null;

  if (similarCards.length > 0) {
    return (
      <div className="space-y-8">
        <RelatedGrid id="similar-kaomoji-heading" heading="Similar Kaomoji" hits={similarCards} />
        <RelatedGrid id="related-kaomoji-heading" heading={heading ?? "Related Kaomoji"} hits={relatedCards} />
      </div>
    );
  }

  return (
    <RelatedGrid id="related-kaomoji-heading" heading={heading ?? "Related Kaomoji"} hits={relatedCards} />
  );
}
