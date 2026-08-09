import { getArtworkPath } from "@/lib/artwork/providers";
import {
  getArtwork,
  getArtworkByProvider,
  listAvailableProviders,
  listVariantsByProvider,
} from "../artwork/adapter";
import { toRuntimeArtworkPath } from "../artwork/paths";
import type { IntegratedArtworkEntry, SupportedArtworkProvider } from "../artwork/types";
import { buildArtworkAttribution, PROVIDER_LABELS } from "./attribution";
import { resolveVariantPreference } from "./shared";
import type {
  UiArtworkDisplayResult,
  UiArtworkProviderOption,
  UiArtworkVariantOption,
} from "./types";

const MAX_SAFE_KEYWORDS = 12;

function toVariantOptions(records: readonly IntegratedArtworkEntry[]): UiArtworkVariantOption[] {
  return records.map((record) =>
    Object.freeze({
      variant: record.variant ?? record.format,
      format: record.format,
      path: toRuntimeArtworkPath(record.path),
      checksumVerified: record.checksumVerified,
    }),
  );
}

export function getUiArtworkProviders(
  canonicalId: string,
  rootDir?: string,
): readonly UiArtworkProviderOption[] {
  const artwork = getArtwork(canonicalId, { rootDir, verifyChecksum: false });
  if (!artwork) {
    return Object.freeze([]);
  }

  const providers = listAvailableProviders(canonicalId, { rootDir, verifyChecksum: false });
  return Object.freeze(
    providers.map((provider) => {
      const records = getArtworkByProvider(canonicalId, provider, { rootDir, verifyChecksum: false });
      const primary = records[0] ?? null;
      return Object.freeze({
        provider,
        label: PROVIDER_LABELS[provider],
        recordCount: records.length,
        variants: Object.freeze(toVariantOptions(records)),
        attribution: buildArtworkAttribution(provider, primary),
      });
    }),
  );
}

function pickArtworkRecord(
  canonicalId: string,
  provider: SupportedArtworkProvider,
  variant: string | null,
  rootDir?: string,
): IntegratedArtworkEntry | null {
  const records = getArtworkByProvider(canonicalId, provider, { rootDir, verifyChecksum: false });
  if (records.length === 0) {
    return null;
  }

  if (variant) {
    const match = records.find(
      (record) => record.variant === variant || record.format === variant || `${record.variant ?? record.format}` === variant,
    );
    if (match) {
      return match;
    }
  }

  const allVariants = listVariantsByProvider(canonicalId, { rootDir, verifyChecksum: false });
  const variants = [...allVariants[provider]];
  if (variants.length === 0) {
    for (const record of records) {
      variants.push(record.variant ?? record.format);
    }
  }
  const preferred = resolveVariantPreference(variants, variant);
  if (preferred) {
    const match = records.find((record) => (record.variant ?? record.format) === preferred);
    if (match) {
      return match;
    }
  }

  return records[0] ?? null;
}

export function resolveUiArtworkDisplay(input: {
  readonly canonicalId: string;
  readonly provider: SupportedArtworkProvider;
  readonly variant?: string | null;
  readonly emoji: string;
  readonly name: string;
  readonly hexcode: string;
  readonly rootDir?: string;
}): UiArtworkDisplayResult {
  const { canonicalId, provider, emoji, name, hexcode, rootDir } = input;
  const record = pickArtworkRecord(canonicalId, provider, input.variant ?? null, rootDir);
  const attribution = buildArtworkAttribution(provider, record);
  const alt = `${name} emoji`;

  if (!record) {
    const productionPath = getArtworkPath(hexcode);
    return Object.freeze({
      canonicalId,
      provider,
      variant: input.variant ?? null,
      src: productionPath,
      alt,
      state: productionPath ? "fallback" : "error",
      fallbackEmoji: emoji,
      attribution,
      checksumVerified: false,
    });
  }

  if (!record.checksumVerified) {
    const productionPath = getArtworkPath(hexcode);
    return Object.freeze({
      canonicalId,
      provider,
      variant: record.variant,
      src: productionPath,
      alt,
      state: "error",
      fallbackEmoji: emoji,
      attribution,
      checksumVerified: false,
    });
  }

  return Object.freeze({
    canonicalId,
    provider,
    variant: record.variant,
    src: toRuntimeArtworkPath(record.path),
    alt,
    state: "loaded",
    fallbackEmoji: emoji,
    attribution,
    checksumVerified: true,
  });
}

export function getUiArtworkFallbackChain(
  canonicalId: string,
  hexcode: string,
  rootDir?: string,
): readonly SupportedArtworkProvider[] {
  const available = listAvailableProviders(canonicalId, { rootDir, verifyChecksum: false });
  const chain: SupportedArtworkProvider[] = [];
  for (const provider of ["openmoji", "noto", "twemoji", "fluent"] as const) {
    if (available.includes(provider)) {
      chain.push(provider);
    }
  }
  if (getArtworkPath(hexcode)) {
    return Object.freeze(chain);
  }
  return Object.freeze(chain);
}

export { MAX_SAFE_KEYWORDS };
