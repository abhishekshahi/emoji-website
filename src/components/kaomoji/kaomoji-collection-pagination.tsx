import Link from "next/link";

interface KaomojiCollectionPaginationProps {
  slug: string;
  page: number;
  totalPages: number;
}

export function KaomojiCollectionPagination({ slug, page, totalPages }: KaomojiCollectionPaginationProps) {
  if (totalPages <= 1) return null;
  const base = `/kaomoji/collections/${slug}/page`;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-2 pt-4" aria-label="Collection pagination">
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
