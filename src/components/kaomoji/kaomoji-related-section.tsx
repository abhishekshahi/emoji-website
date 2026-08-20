import { KaomojiCard, type KaomojiCardData } from "@/components/kaomoji/kaomoji-card";

interface KaomojiRelatedSectionProps {
  readonly heading?: string;
  readonly items: readonly KaomojiCardData[];
}

export function KaomojiRelatedSection({ heading = "Related Kaomoji", items }: KaomojiRelatedSectionProps) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-4 max-w-4xl mx-auto" aria-labelledby="related-kaomoji-heading">
      <h2 id="related-kaomoji-heading" className="text-lg font-semibold">
        {heading}
      </h2>
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 list-none p-0 m-0">
        {items.map((item) => (
          <li key={item.canonical_id}>
            <KaomojiCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
