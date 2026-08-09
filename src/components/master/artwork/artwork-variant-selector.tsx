"use client";

interface ArtworkVariantSelectorProps {
  variants: readonly string[];
  selectedVariant: string | null;
  onSelect: (variant: string) => void;
}

export function ArtworkVariantSelector({
  variants,
  selectedVariant,
  onSelect,
}: ArtworkVariantSelectorProps) {
  if (variants.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-muted">Variant</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Artwork variant">
        {variants.map((variant) => {
          const selected = variant === selectedVariant;
          return (
            <button
              key={variant}
              type="button"
              onClick={() => onSelect(variant)}
              className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                selected
                  ? "bg-surface-muted text-foreground"
                  : "border border-border bg-surface hover:bg-surface-muted"
              }`}
            >
              {variant.replace(/-/g, " ")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
