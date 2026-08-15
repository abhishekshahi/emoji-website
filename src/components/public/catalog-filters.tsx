import Link from "next/link";
import type { CatalogFilterType } from "@/lib/master/public/catalog-service";

interface CatalogFiltersProps {
  activeFilter: CatalogFilterType;
  counts: Record<CatalogFilterType, number>;
  search?: string;
}

const FILTERS: { id: CatalogFilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unicode", label: "Unicode" },
  { id: "source-specific", label: "Source-specific" },
  { id: "private-use", label: "Private-use" },
];

export function CatalogFilters({ activeFilter, counts, search }: CatalogFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const params = new URLSearchParams();
        if (filter.id !== "all") params.set("filter", filter.id);
        if (search) params.set("q", search);
        const href = params.toString() ? `/catalog?${params}` : "/catalog";
        const active = activeFilter === filter.id;
        return (
          <Link
            key={filter.id}
            href={href}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-accent text-accent-foreground"
                : "border border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            {filter.label} ({counts[filter.id].toLocaleString()})
          </Link>
        );
      })}
    </div>
  );
}
