"use client";

import { useMemo, useState } from "react";
import type { SupportedArtworkProvider } from "@/lib/master/integration/artwork/types";
import type { UiArtworkProviderOption } from "@/lib/master/integration/ui/types";
import {
  readStoredArtworkProvider,
  resolvePresentationProvider,
  resolveVariantPreference,
  writeStoredArtworkProvider,
} from "@/lib/master/integration/ui/provider-state.client";
import { ArtworkAttribution } from "@/components/master/provider/artwork-attribution";
import { ArtworkProviderSelector } from "@/components/master/provider/artwork-provider-selector";
import { ArtworkVariantSelector } from "@/components/master/artwork/artwork-variant-selector";

interface ArtworkGalleryProps {
  emoji: string;
  name: string;
  fallbackSrc: string | null;
  providers: readonly UiArtworkProviderOption[];
}

export function ArtworkGallery({
  emoji,
  name,
  fallbackSrc,
  providers,
}: ArtworkGalleryProps) {
  const availableProviders = useMemo(
    () => providers.map((provider) => provider.provider),
    [providers],
  );

  const [provider, setProvider] = useState<SupportedArtworkProvider>(() => {
    const stored = readStoredArtworkProvider();
    return resolvePresentationProvider(availableProviders, stored) ?? "openmoji";
  });
  const [preferredVariant, setPreferredVariant] = useState<string | null>(null);

  const activeProvider = providers.find((entry) => entry.provider === provider) ?? providers[0];
  const variantNames = useMemo(
    () => activeProvider?.variants.map((variant) => variant.variant) ?? [],
    [activeProvider],
  );
  const variant = resolveVariantPreference(variantNames, preferredVariant);

  const activeVariant = activeProvider?.variants.find((entry) => entry.variant === variant) ?? activeProvider?.variants[0] ?? null;
  const src = activeVariant?.checksumVerified ? activeVariant.path : fallbackSrc;
  const attribution = activeProvider?.attribution;

  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(() =>
    src ? "loading" : "error",
  );

  if (providers.length === 0 || !attribution) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-[1rem] border border-border bg-surface-muted/50 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Artwork gallery</h2>
        <p className="text-sm text-muted">
          Compare artwork styles for the same emoji identity. Provider choice is local UI state only.
        </p>
      </div>

      <ArtworkProviderSelector
        providers={providers}
        selectedProvider={activeProvider.provider}
        onSelect={(nextProvider) => {
          setProvider(nextProvider);
          setPreferredVariant(null);
          setImageState("loading");
          writeStoredArtworkProvider(nextProvider);
        }}
      />

      <ArtworkVariantSelector
        variants={variantNames}
        selectedVariant={variant}
        onSelect={(nextVariant) => {
          setPreferredVariant(nextVariant);
          setImageState("loading");
        }}
      />

      <div className="flex flex-col items-center gap-4 rounded-[1rem] bg-surface p-6">
        {src && imageState !== "error" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${provider}:${variant}:${src}`}
            src={src}
            alt={`${name} emoji`}
            width={176}
            height={176}
            loading="lazy"
            decoding="async"
            className="h-36 w-36 object-contain sm:h-44 sm:w-44"
            onLoad={() => setImageState("loaded")}
            onError={() => setImageState("error")}
          />
        ) : (
          <span className="text-8xl leading-none" aria-hidden="true">
            {emoji}
          </span>
        )}

        {imageState === "loading" && src ? (
          <p className="text-xs text-muted">Loading artwork…</p>
        ) : null}

        <ArtworkAttribution attribution={attribution} compact />
      </div>
    </section>
  );
}
