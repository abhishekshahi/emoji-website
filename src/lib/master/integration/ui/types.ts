import type { SupportedArtworkProvider } from "../artwork/types";
import type { MetadataSourceKey } from "../metadata/types";

export const UI_INTEGRATION_PHASE = "8.11E" as const;

export const UI_BASELINES = {
  canonicalIdentities: 6955,
  masterArtworkRecords: 40071,
  masterMetadataRecords: 42910,
  openmojiArtwork: 4495,
  notoArtwork: 19673,
  twemojiArtwork: 8018,
  fluentArtwork: 7885,
  productionMappings: 4486,
  safeAliases: 3580,
  restrictedAliases: 435,
  canonicalKeywords: 43977,
  shortcodes: 14304,
  safeSearchTerms: 29468,
  emojinetSenses: 15183,
} as const;

export type ArtworkDisplayState = "loading" | "loaded" | "error" | "fallback";

export interface ArtworkAttributionInfo {
  readonly provider: SupportedArtworkProvider;
  readonly providerLabel: string;
  readonly license: string;
  readonly licenseURL: string;
  readonly attribution: string | null;
  readonly sourceVersion: string;
}

export interface UiArtworkVariantOption {
  readonly variant: string;
  readonly format: "svg" | "png";
  readonly path: string;
  readonly checksumVerified: boolean;
}

export interface UiArtworkProviderOption {
  readonly provider: SupportedArtworkProvider;
  readonly label: string;
  readonly recordCount: number;
  readonly variants: readonly UiArtworkVariantOption[];
  readonly attribution: ArtworkAttributionInfo;
}

export interface UiArtworkDisplayResult {
  readonly canonicalId: string;
  readonly provider: SupportedArtworkProvider;
  readonly variant: string | null;
  readonly src: string | null;
  readonly alt: string;
  readonly state: ArtworkDisplayState;
  readonly fallbackEmoji: string;
  readonly attribution: ArtworkAttributionInfo;
  readonly checksumVerified: boolean;
}

export interface UiSourceMetadataPanel {
  readonly source: MetadataSourceKey | "noto" | "twemoji";
  readonly label: string;
  readonly available: boolean;
  readonly name: string | null;
  readonly keywords: readonly string[];
  readonly aliases: readonly string[];
  readonly shortcodes: readonly string[];
  readonly definition: string | null;
  readonly sourceVersion: string | null;
}

export interface UiMetadataPayload {
  readonly canonicalId: string;
  readonly canonicalName: string;
  readonly emoji: string | null;
  readonly safeKeywords: readonly string[];
  readonly safeAliases: readonly string[];
  readonly shortcodes: readonly string[];
  readonly sourcePanels: readonly UiSourceMetadataPanel[];
  readonly emojinetSenseCount: number;
  readonly emojinetDefinitionCount: number;
  readonly hasSemanticSourceData: boolean;
}

export interface UiProductionContext {
  readonly hexcode: string;
  readonly productionType: "standard" | "extra";
  readonly emoji: string;
  readonly name: string;
  readonly slug: string;
}

export interface MasterEmojiUiModel {
  readonly emoji: string;
  readonly name: string;
  readonly fallbackSrc: string | null;
  readonly artworkProviders: readonly UiArtworkProviderOption[];
  readonly metadata: UiMetadataPayload | null;
}

export interface UiIntegrationAuditReport {
  readonly generatedAt: string;
  readonly phase: typeof UI_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly artworkIntegration: "PASS" | "FAIL";
  readonly metadataIntegration: "PASS" | "FAIL";
  readonly providerSelector: "PASS" | "FAIL";
  readonly variantSelector: "PASS" | "FAIL";
  readonly attribution: "PASS" | "FAIL";
  readonly license: "PASS" | "FAIL";
  readonly favorites: "PASS" | "FAIL";
  readonly recents: "PASS" | "FAIL";
  readonly copy: "PASS" | "FAIL";
  readonly puaProtection: "PASS" | "FAIL";
  readonly artworkOnlyProtection: "PASS" | "FAIL";
  readonly featureFlag: "PASS" | "FAIL";
  readonly frozenRelease: "PASS" | "FAIL";
  readonly routesChanged: false;
  readonly seoChanged: false;
  readonly searchChanged: false;
  readonly externalRuntimeDependencies: false;
  readonly status: "PASS" | "FAIL";
}

export interface UiIntegrationManifest {
  readonly generatedAt: string;
  readonly phase: typeof UI_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly featureFlags: Readonly<{
    readonly masterArtworkEnabled: false;
    readonly masterMetadataEnabled: false;
    readonly masterSearchEnabled: false;
    readonly masterSEOEnabled: false;
  }>;
  readonly outputs: Readonly<Record<string, string>>;
}
