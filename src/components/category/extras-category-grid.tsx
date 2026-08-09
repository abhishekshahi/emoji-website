import Link from "next/link";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/emoji/data";
import { getOpenMojiExtraCategories } from "@/lib/emoji/extras-data";

export function ExtrasCategoryGrid() {
  const categories = getOpenMojiExtraCategories();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/category/${category.id}`}
          className="card-surface flex items-center gap-4 p-5 transition hover:-translate-y-0.5"
        >
          <span className="text-4xl" aria-hidden="true">
            {getCategoryEmoji(category.id)}
          </span>
          <span>
            <span className="block text-lg font-semibold">
              {getCategoryLabel(category.id)}
            </span>
            <span className="mt-1 block text-sm text-muted">
              OpenMoji extra collection
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
