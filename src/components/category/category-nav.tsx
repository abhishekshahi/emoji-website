import Link from "next/link";
import {
  CATEGORY_EMOJIS,
  CATEGORY_LABELS,
} from "@/lib/emoji/constants";
import { getCategories } from "@/lib/emoji/data";

export function CategoryNav() {
  const categories = getCategories();

  return (
    <nav aria-label="Emoji categories" className="flex gap-2 overflow-x-auto pb-1">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/category/${category.id}`}
          className="pill-link min-h-11 shrink-0"
        >
          <span aria-hidden="true">{CATEGORY_EMOJIS[category.id] ?? "✨"}</span>
          <span>{CATEGORY_LABELS[category.id] ?? category.label}</span>
        </Link>
      ))}
    </nav>
  );
}
