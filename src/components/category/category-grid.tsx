import Link from "next/link";
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
} from "@/lib/emoji/constants";
import { getCategories } from "@/lib/emoji/data";

export function CategoryGrid() {
  const categories = getCategories();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/category/${category.id}`}
          className="card-surface flex items-center gap-4 p-5 transition hover:-translate-y-0.5"
        >
          <span className="text-4xl" aria-hidden="true">
            {CATEGORY_EMOJIS[category.id] ?? "✨"}
          </span>
          <span>
            <span className="block text-lg font-semibold">
              {CATEGORY_LABELS[category.id] ?? category.label}
            </span>
            <span className="mt-1 block text-sm text-muted">
              {category.subcategories.length} subcategories
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
