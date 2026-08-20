import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { getArtworkProviderPolicy } from "@/lib/master/public/license-registry";

/** Central priority order for preferred artwork resolution (8.62-B). */
export const ARTWORK_PRIORITY_ORDER: readonly ArtworkProvider[] = [
  "noto",
  "fluent",
  "openmoji",
  "twemoji",
] as const;

export type ArtworkAvailability = "public" | "indexed" | "missing";

export interface ProviderArchitectureEntry {
  readonly provider: ArtworkProvider;
  readonly label: string;
  readonly availability: ArtworkAvailability;
  readonly publiclyServed: boolean;
  readonly licenseGated: boolean;
  readonly license: string;
  readonly priorityRank: number;
}

const PROVIDER_LABELS: Record<ArtworkProvider, string> = {
  noto: "Noto Emoji",
  fluent: "Fluent Emoji",
  openmoji: "OpenMoji",
  twemoji: "Twemoji",
};

const PROVIDER_LICENSES: Record<ArtworkProvider, string> = {
  noto: "Apache-2.0 / OFL",
  fluent: "MIT",
  openmoji: "CC BY-SA 4.0",
  twemoji: "CC BY 4.0",
};

/** Four-provider architecture: public when registry + asset-rights permit. */
export function getProviderArchitecture(): readonly ProviderArchitectureEntry[] {
  return ARTWORK_PRIORITY_ORDER.map((provider, index) => {
    const policy = getArtworkProviderPolicy(provider);
    const publiclyServed = policy.publicServingAllowed;

    return Object.freeze({
      provider,
      label: PROVIDER_LABELS[provider],
      availability: publiclyServed ? "public" : "indexed",
      publiclyServed,
      licenseGated: !publiclyServed,
      license: PROVIDER_LICENSES[provider],
      priorityRank: index + 1,
    });
  });
}

export function isPublicArtworkProvider(provider: ArtworkProvider): boolean {
  return getArtworkProviderPolicy(provider).publicServingAllowed;
}

export function resolveArtworkAvailability(
  provider: ArtworkProvider,
  hasAssets: boolean,
): ArtworkAvailability {
  if (!hasAssets) return "missing";
  return isPublicArtworkProvider(provider) ? "public" : "indexed";
}
