import Link from "next/link";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { getCategoryLabel } from "@/lib/emoji/data";
import type { BrowsableEmoji } from "@/lib/emoji/types";

interface SubcategoryGroup {
  readonly id: string;
  readonly label: string;
  readonly emojis: readonly BrowsableEmoji[];
}

interface CategorySubcategorySectionsProps {
  emojis: readonly BrowsableEmoji[];
  categoryId: string;
}

function formatSubcategoryLabel(subcategory: string): string {
  return subcategory
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSubcategoryGroups(emojis: readonly BrowsableEmoji[]): SubcategoryGroup[] {
  const groups = new Map<string, BrowsableEmoji[]>();

  for (const emoji of emojis) {
    const bucket = groups.get(emoji.subcategory) ?? [];
    bucket.push(emoji);
    groups.set(emoji.subcategory, bucket);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, groupEmojis]) => ({
      id,
      label: formatSubcategoryLabel(id),
      emojis: groupEmojis,
    }));
}

export function CategorySubcategorySections({
  emojis,
  categoryId,
}: CategorySubcategorySectionsProps) {
  const groups = buildSubcategoryGroups(emojis);

  if (groups.length <= 1) {
    return <EmojiGrid emojis={[...emojis]} />;
  }

  return (
    <div className="space-y-10">
      <nav aria-label="Subcategories" className="card-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Subcategories</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {groups.map((group) => (
            <li key={group.id}>
              <a
                href={`#subcategory-${group.id}`}
                className="inline-flex min-h-11 items-center rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted"
              >
                {group.label}
                <span className="ml-2 text-xs text-muted">({group.emojis.length})</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {groups.map((group) => (
        <section
          key={group.id}
          id={`subcategory-${group.id}`}
          className="scroll-mt-24 space-y-4"
          aria-labelledby={`subcategory-heading-${group.id}`}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id={`subcategory-heading-${group.id}`} className="section-title">
                {group.label}
              </h2>
              <p className="section-subtitle">
                {group.emojis.length.toLocaleString()} emoji
                {group.emojis.length === 1 ? "" : "s"} in {getCategoryLabel(categoryId)}
              </p>
            </div>
            <Link href="/search" className="pill-link">
              Search in {group.label.toLowerCase()}
            </Link>
          </div>
          <EmojiGrid emojis={[...group.emojis]} pageSize={24} />
        </section>
      ))}
    </div>
  );
}
