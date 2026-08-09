import type { ArtworkProvider } from "@/lib/master/canonical/types";
import { getMasterReader } from "../master-reader";
import type { MasterArtworkEntry, MasterArtworkLookup } from "../types";
import { assertArtworkChecksum } from "./checksum";
import { assertLocalArtworkPath } from "./paths";
import type {
  IntegratedArtworkEntry,
  IntegratedArtworkLookup,
  IntegratedArtworkProviders,
  SupportedArtworkProvider,
} from "./types";
import { ARTWORK_PROVIDERS } from "./types";

function toIntegratedEntry(
  record: MasterArtworkEntry,
  options: { verifyChecksum: boolean; rootDir?: string },
): IntegratedArtworkEntry {
  if (options.verifyChecksum) {
    assertArtworkChecksum(record.artworkId, record.checksum, options.rootDir);
  }

  return Object.freeze({
    provider: record.provider,
    artworkId: record.artworkId,
    canonicalId: record.canonicalId,
    sourceId: record.sourceId,
    path: assertLocalArtworkPath(record.path),
    localPath: record.localPath,
    format: record.format,
    variant: record.variant,
    license: record.license,
    licenseURL: record.licenseURL,
    attribution: record.attribution,
    checksum: record.checksum,
    checksumVerified: record.checksumVerified,
    duplicateBinary: record.duplicateBinary,
    duplicateBinaryGroupId: record.duplicateBinaryGroupId,
    sourceVersion: record.sourceVersion,
  });
}

function convertProviders(
  providers: IntegratedArtworkProviders | MasterArtworkLookup["providers"],
  options: { verifyChecksum: boolean; rootDir?: string },
): IntegratedArtworkProviders {
  const convert = (records: readonly MasterArtworkEntry[]): readonly IntegratedArtworkEntry[] =>
    Object.freeze(records.map((record) => toIntegratedEntry(record, options)));

  return Object.freeze({
    openmoji: convert(providers.openmoji),
    noto: convert(providers.noto),
    twemoji: convert(providers.twemoji),
    fluent: convert(providers.fluent),
  });
}

export interface ArtworkLookupOptions {
  readonly rootDir?: string;
  readonly verifyChecksum?: boolean;
}

function resolveOptions(options: ArtworkLookupOptions = {}): { verifyChecksum: boolean; rootDir?: string } {
  return {
    verifyChecksum: options.verifyChecksum ?? true,
    rootDir: options.rootDir,
  };
}

export function getArtwork(
  canonicalId: string,
  options: ArtworkLookupOptions = {},
): IntegratedArtworkLookup | null {
  const reader = getMasterReader(options.rootDir);
  const providers = reader.artworkByCanonical.get(canonicalId);
  if (!providers) {
    return null;
  }

  const resolved = resolveOptions(options);
  const converted = convertProviders(providers, resolved);
  const totalRecords =
    converted.openmoji.length +
    converted.noto.length +
    converted.twemoji.length +
    converted.fluent.length;

  if (totalRecords === 0) {
    return null;
  }

  return Object.freeze({
    canonicalId,
    providers: converted,
    totalRecords,
  });
}

export function getArtworkByProvider(
  canonicalId: string,
  provider: ArtworkProvider,
  options: ArtworkLookupOptions = {},
): readonly IntegratedArtworkEntry[] {
  const lookup = getArtwork(canonicalId, options);
  if (!lookup) {
    return Object.freeze([]);
  }
  return lookup.providers[provider];
}

export function getArtworkVariants(
  canonicalId: string,
  provider?: ArtworkProvider,
  options: ArtworkLookupOptions = {},
): readonly IntegratedArtworkEntry[] {
  const lookup = getArtwork(canonicalId, options);
  if (!lookup) {
    return Object.freeze([]);
  }

  if (provider) {
    return lookup.providers[provider];
  }

  return Object.freeze(ARTWORK_PROVIDERS.flatMap((key) => [...lookup.providers[key]]));
}

export function getArtworkByVariant(
  canonicalId: string,
  provider: ArtworkProvider,
  variant: string,
  options: ArtworkLookupOptions = {},
): IntegratedArtworkEntry | null {
  const records = getArtworkByProvider(canonicalId, provider, options);
  const normalizedVariant = variant.toLowerCase();
  return (
    records.find((record) => (record.variant ?? "").toLowerCase() === normalizedVariant) ?? null
  );
}

export function listAvailableProviders(
  canonicalId: string,
  options: ArtworkLookupOptions = {},
): readonly SupportedArtworkProvider[] {
  const lookup = getArtwork(canonicalId, options);
  if (!lookup) {
    return Object.freeze([]);
  }

  return Object.freeze(
    ARTWORK_PROVIDERS.filter((provider) => lookup.providers[provider].length > 0),
  );
}

export function listVariantsByProvider(
  canonicalId: string,
  options: ArtworkLookupOptions = {},
): Record<SupportedArtworkProvider, readonly string[]> {
  const lookup = getArtwork(canonicalId, options);
  if (!lookup) {
    return Object.freeze({
      openmoji: Object.freeze([]),
      noto: Object.freeze([]),
      twemoji: Object.freeze([]),
      fluent: Object.freeze([]),
    });
  }

  const variants = {
    openmoji: [] as string[],
    noto: [] as string[],
    twemoji: [] as string[],
    fluent: [] as string[],
  };

  for (const provider of ARTWORK_PROVIDERS) {
    variants[provider] = [
      ...new Set(
        lookup.providers[provider]
          .map((record) => record.variant)
          .filter((variant): variant is string => Boolean(variant)),
      ),
    ];
  }

  return Object.freeze({
    openmoji: Object.freeze(variants.openmoji),
    noto: Object.freeze(variants.noto),
    twemoji: Object.freeze(variants.twemoji),
    fluent: Object.freeze(variants.fluent),
  });
}
