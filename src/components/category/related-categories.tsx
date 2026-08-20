"use client";

import Link from "next/link";
import { CATEGORY_EMOJIS } from "@/lib/emoji/constants";
import { getCategoryLabel } from "@/lib/emoji/data";

interface RelatedCategoriesProps {
  categoryIds: readonly string[];
  currentCategoryId: string;
}

export function RelatedCategories({
  categoryIds,
  currentCategoryId,
}: RelatedCategoriesProps) {
  const related = categoryIds.filter((categoryId) => categoryId !== currentCategoryId);
  if (!related.length) {
    return null;
  }

  return (
    <section className="card-surface space-y-4 p-6" aria-labelledby="related-categories-heading">
      <h2 id="related-categories-heading" className="section-title">
        Related categories
      </h2>
      <ul className="flex flex-wrap gap-2">
        {related.map((categoryId) => (
          <li key={categoryId}>
            <Link
              href={`/category/${categoryId}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted"
            >
              <span aria-hidden="true">{CATEGORY_EMOJIS[categoryId] ?? "✨"}</span>
              {getCategoryLabel(categoryId)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
