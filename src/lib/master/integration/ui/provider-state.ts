import type { SupportedArtworkProvider } from "../artwork/types";
import { ARTWORK_PROVIDERS } from "../artwork/types";

export const ARTWORK_PROVIDER_PREFERENCE_KEY = "emojiquick:artwork-provider-preference";
export const LEGACY_ARTWORK_PROVIDER_PREFERENCE_KEY = "emojifind:artwork-provider-preference";

export const DEFAULT_PRESENTATION_PROVIDER: SupportedArtworkProvider = "openmoji";

export const DETERMINISTIC_UI_FALLBACK_ORDER: readonly SupportedArtworkProvider[] = Object.freeze([
  "openmoji",
  "noto",
  "twemoji",
  "fluent",
]);

export function isSupportedArtworkProvider(value: string): value is SupportedArtworkProvider {
  return (ARTWORK_PROVIDERS as readonly string[]).includes(value);
}

export function readStoredArtworkProvider(): SupportedArtworkProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(ARTWORK_PROVIDER_PREFERENCE_KEY);
    if (!stored || !isSupportedArtworkProvider(stored)) {
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export function writeStoredArtworkProvider(provider: SupportedArtworkProvider): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ARTWORK_PROVIDER_PREFERENCE_KEY, provider);
  } catch {
    // Ignore storage failures.
  }
}

export function resolvePresentationProvider(
  availableProviders: readonly SupportedArtworkProvider[],
  storedPreference: SupportedArtworkProvider | null,
): SupportedArtworkProvider | null {
  if (availableProviders.length === 0) {
    return null;
  }

  if (storedPreference && availableProviders.includes(storedPreference)) {
    return storedPreference;
  }

  for (const provider of DETERMINISTIC_UI_FALLBACK_ORDER) {
    if (availableProviders.includes(provider)) {
      return provider;
    }
  }

  return availableProviders[0] ?? null;
}

export { resolveVariantPreference } from "./shared";
