import type { IntegratedArtworkEntry } from "../artwork/types";
import type { SupportedArtworkProvider } from "../artwork/types";
import type { ArtworkAttributionInfo } from "./types";

export const PROVIDER_LABELS: Readonly<Record<SupportedArtworkProvider, string>> = Object.freeze({
  openmoji: "OpenMoji",
  noto: "Noto",
  twemoji: "Twemoji",
  fluent: "Fluent",
});

export const PROVIDER_LICENSE_DEFAULTS: Readonly<
  Record<SupportedArtworkProvider, { readonly license: string; readonly licenseURL: string }>
> = Object.freeze({
  openmoji: Object.freeze({
    license: "CC BY-SA 4.0",
    licenseURL: "https://creativecommons.org/licenses/by-sa/4.0/",
  }),
  noto: Object.freeze({
    license: "Apache-2.0",
    licenseURL: "https://www.apache.org/licenses/LICENSE-2.0",
  }),
  twemoji: Object.freeze({
    license: "CC BY 4.0",
    licenseURL: "https://creativecommons.org/licenses/by/4.0/",
  }),
  fluent: Object.freeze({
    license: "MIT",
    licenseURL: "https://opensource.org/licenses/MIT",
  }),
});

export function buildArtworkAttribution(
  provider: SupportedArtworkProvider,
  entry: IntegratedArtworkEntry | null,
): ArtworkAttributionInfo {
  const defaults = PROVIDER_LICENSE_DEFAULTS[provider];
  return Object.freeze({
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    license: entry?.license ?? defaults.license,
    licenseURL: entry?.licenseURL ?? defaults.licenseURL,
    attribution: entry?.attribution ?? null,
    sourceVersion: entry?.sourceVersion ?? "unknown",
  });
}

export function formatArtworkRecordCount(totalRecords: number, providerCount = 4): string {
  return `${totalRecords.toLocaleString()} artwork records across ${providerCount} providers`;
}

export function formatCanonicalIdentityCount(count: number): string {
  return `${count.toLocaleString()} canonical identities`;
}

export function formatProductionRecordCount(count: number): string {
  return `${count.toLocaleString()} current production records`;
}
