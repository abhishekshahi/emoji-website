"use client";

import type { SupportedArtworkProvider } from "@/lib/master/integration/artwork/types";
import type { UiArtworkProviderOption } from "@/lib/master/integration/ui/types";

interface ArtworkProviderSelectorProps {
  providers: readonly UiArtworkProviderOption[];
  selectedProvider: SupportedArtworkProvider;
  onSelect: (provider: SupportedArtworkProvider) => void;
}

export function ArtworkProviderSelector({
  providers,
  selectedProvider,
  onSelect,
}: ArtworkProviderSelectorProps) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-muted">Artwork style</p>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Artwork provider"
      >
        {providers.map((provider) => {
          const selected = provider.provider === selectedProvider;
          return (
            <button
              key={provider.provider}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(provider.provider)}
              className={`min-h-10 rounded-full px-4 py-2 text-sm font-semibold transition ${
                selected
                  ? "bg-accent text-accent-foreground"
                  : "border border-border bg-surface hover:bg-surface-muted"
              }`}
            >
              {provider.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
