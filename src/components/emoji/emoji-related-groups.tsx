import Link from "next/link";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import type { RelatedEmojiGroupView } from "@/lib/emoji/emoji-page-model";

interface EmojiRelatedGroupsProps {
  groups: readonly RelatedEmojiGroupView[];
  categoryLabel: string;
  categoryId: string;
}

export function EmojiRelatedGroups({
  groups,
  categoryLabel,
  categoryId,
}: EmojiRelatedGroupsProps) {
  if (!groups.length) {
    return null;
  }

  return (
    <section className="space-y-8" aria-labelledby="related-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 id="related-heading" className="section-title">
            Related emojis
          </h2>
          <p className="section-subtitle">
            Discover similar emojis, variants, and nearby symbols from the same category.
          </p>
        </div>
        <Link href={`/category/${categoryId}`} className="pill-link">
          Browse {categoryLabel}
        </Link>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.id} className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">{group.title}</h3>
              <p className="text-sm text-muted">{group.description}</p>
            </div>
            <EmojiGrid emojis={[...group.emojis]} pageSize={group.emojis.length} />
          </div>
        ))}
      </div>
    </section>
  );
}
