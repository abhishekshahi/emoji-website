"use client";

import type { ClientArtworkProvider } from "@/lib/master/integration/ui/client-types";
import { CLIENT_ARTWORK_PROVIDERS } from "@/lib/master/integration/ui/client-types";

export const ARTWORK_PROVIDER_PREFERENCE_KEY = "emojiquick:artwork-provider-preference";
export const LEGACY_ARTWORK_PROVIDER_PREFERENCE_KEY = "emojifind:artwork-provider-preference";

export const DEFAULT_PRESENTATION_PROVIDER: ClientArtworkProvider = "openmoji";

export const DETERMINISTIC_UI_FALLBACK_ORDER: readonly ClientArtworkProvider[] = Object.freeze([
  "openmoji",
  "noto",
  "twemoji",
  "fluent",
]);

export function isSupportedArtworkProvider(value: string): value is ClientArtworkProvider {
  return (CLIENT_ARTWORK_PROVIDERS as readonly string[]).includes(value);
}

export function readStoredArtworkProvider(): ClientArtworkProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(ARTWORK_PROVIDER_PREFERENCE_KEY);
    if (stored && isSupportedArtworkProvider(stored)) {
      return stored;
    }
    const legacy = window.localStorage.getItem(LEGACY_ARTWORK_PROVIDER_PREFERENCE_KEY);
    if (legacy && isSupportedArtworkProvider(legacy)) {
      window.localStorage.setItem(ARTWORK_PROVIDER_PREFERENCE_KEY, legacy);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStoredArtworkProvider(provider: ClientArtworkProvider): void {
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
  availableProviders: readonly ClientArtworkProvider[],
  storedPreference: ClientArtworkProvider | null,
): ClientArtworkProvider | null {
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
