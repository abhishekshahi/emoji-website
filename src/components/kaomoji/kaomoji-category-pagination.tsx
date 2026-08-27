import Link from "next/link";

interface KaomojiCategoryPaginationProps {
  group: string;
  slug: string;
  page: number;
  totalPages: number;
}

export function KaomojiCategoryPagination({ group, slug, page, totalPages }: KaomojiCategoryPaginationProps) {
  if (totalPages <= 1) return null;
  const base = `/kaomoji/categories/${group}/${slug}/page`;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-4" aria-label="Category pagination">
      {page > 1 ? (
        <Link href={`${base}/${page - 1}`} className="btn btn--secondary btn--sm min-h-9" rel="prev">
          Previous
        </Link>
      ) : null}
      <span className="text-sm text-muted px-2">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`${base}/${page + 1}`} className="btn btn--secondary btn--sm min-h-9" rel="next">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
