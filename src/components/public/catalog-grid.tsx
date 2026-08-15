import Link from "next/link";
import type { CatalogItemSummary } from "@/lib/master/public/catalog-service";
import { IdentityTypeBadge } from "./identity-type-badge";

interface CatalogGridProps {
  items: readonly CatalogItemSummary[];
}

export function CatalogGrid({ items }: CatalogGridProps) {
  if (items.length === 0) {
    return (
      <div className="card-surface px-6 py-12 text-center text-muted">
        No identities match your filters.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.canonicalId}
          href={item.catalogUrl}
          className="card-surface flex flex-col gap-2 p-4 transition hover:border-accent/40"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-3xl leading-none" aria-hidden="true">
              {item.emoji ?? "·"}
            </span>
            <IdentityTypeBadge identityType={item.identityType} />
          </div>
          <div>
            <p className="font-semibold leading-tight">{item.canonicalName}</p>
            {item.hexcode ? (
              <p className="mt-1 font-mono text-xs text-muted">U+{item.hexcode.replace(/-/g, " U+")}</p>
            ) : null}
          </div>
          <div className="mt-auto flex flex-wrap gap-1 text-xs text-muted">
            {item.seoPageUrl ? (
              <span className="rounded bg-accent-soft px-2 py-0.5 text-accent-strong">SEO page</span>
            ) : (
              <span className="rounded bg-surface-muted px-2 py-0.5">Catalog only</span>
            )}
            {item.hasArtwork ? <span className="rounded bg-surface-muted px-2 py-0.5">Artwork</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
