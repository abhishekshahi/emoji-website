import Link from "next/link";
import type { VariantGroupView } from "@/lib/emoji/emoji-page-model";

interface EmojiVariantExplorerProps {
  groups: readonly VariantGroupView[];
  baseSlug: string | null;
  currentSlug: string;
}

export function EmojiVariantExplorer({
  groups,
  baseSlug,
  currentSlug,
}: EmojiVariantExplorerProps) {
  if (!groups.length) {
    return null;
  }

  const showBaseLink = baseSlug && baseSlug !== currentSlug;

  return (
    <section className="space-y-6" aria-labelledby="variants-heading">
      <div className="space-y-2">
        <h2 id="variants-heading" className="section-title">
          Variants
        </h2>
        <p className="section-subtitle">
          Explore related Unicode forms. Each variant links to its own canonical emoji page.
        </p>
        {showBaseLink ? (
          <p className="text-sm text-muted">
            Base form:{" "}
            <Link href={`/emoji/${baseSlug}`} className="font-medium text-accent-strong underline">
              View base emoji
            </Link>
          </p>
        ) : null}
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.kind} className="card-surface space-y-4 p-4 sm:p-6">
            <h3 className="text-base font-semibold">{group.title}</h3>
            <ul className="flex flex-wrap gap-2">
              {group.variants.map((variant) => (
                <li key={variant.slug}>
                  <Link
                    href={`/emoji/${variant.slug}`}
                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-xl border border-border bg-surface-muted/40 px-3 py-2 transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    aria-label={`${variant.label}: ${variant.emoji.name}`}
                    title={variant.emoji.name}
                  >
                    <span className="text-2xl leading-none sm:text-3xl" aria-hidden="true">
                      {variant.emoji.emoji}
                    </span>
                    <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
                      {variant.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              {group.variants.length} variant{group.variants.length === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
