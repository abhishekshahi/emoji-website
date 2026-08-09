import type { ArtworkProvider } from "@/lib/master/canonical/types";

export type ArtworkFormat = "svg" | "png";

export const ARTWORK_PROVIDERS = ["openmoji", "noto", "twemoji", "fluent"] as const;

export type SupportedArtworkProvider = (typeof ARTWORK_PROVIDERS)[number];

export interface IntegratedArtworkEntry {
  readonly provider: ArtworkProvider;
  readonly artworkId: string;
  readonly canonicalId: string;
  readonly sourceId: string;
  readonly path: string;
  readonly localPath: string;
  readonly format: ArtworkFormat;
  readonly variant: string | null;
  readonly license: string;
  readonly licenseURL: string;
  readonly attribution: string | null;
  readonly checksum: string;
  readonly checksumVerified: boolean;
  readonly duplicateBinary: boolean;
  readonly duplicateBinaryGroupId: string | null;
  readonly sourceVersion: string;
}

export interface IntegratedArtworkProviders {
  readonly openmoji: readonly IntegratedArtworkEntry[];
  readonly noto: readonly IntegratedArtworkEntry[];
  readonly twemoji: readonly IntegratedArtworkEntry[];
  readonly fluent: readonly IntegratedArtworkEntry[];
}

export interface IntegratedArtworkLookup {
  readonly canonicalId: string;
  readonly providers: IntegratedArtworkProviders;
  readonly totalRecords: number;
}

export type ArtworkProviderPreference = SupportedArtworkProvider | null;

export interface ProductionArtworkCoverageEntry {
  readonly productionId: string;
  readonly productionHexcode: string;
  readonly productionType: "standard" | "extra";
  readonly canonicalId: string;
  readonly availableProviders: readonly SupportedArtworkProvider[];
  readonly missingProviders: readonly SupportedArtworkProvider[];
  readonly variantsByProvider: Record<SupportedArtworkProvider, readonly string[]>;
  readonly artworkRecordCount: number;
}

export interface ArtworkProductionCoverageReport {
  readonly generatedAt: string;
  readonly phase: "8.11B";
  readonly releaseId: string;
  readonly totalProductionRecords: number;
  readonly mappedRecords: number;
  readonly entries: readonly ProductionArtworkCoverageEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface ArtworkProviderCoverageReport {
  readonly generatedAt: string;
  readonly phase: "8.11B";
  readonly releaseId: string;
  readonly totals: {
    readonly masterArtworkRecords: number;
    readonly openmoji: number;
    readonly noto: number;
    readonly twemoji: number;
    readonly fluent: number;
    readonly svg: number;
    readonly png: number;
    readonly duplicateBinaryRecords: number;
    readonly duplicateBinaryGroups: number;
    readonly missingFiles: number;
    readonly checksumFailures: number;
    readonly pathCollisions: number;
  };
  readonly status: "PASS" | "FAIL";
}

export interface ArtworkIntegrationAuditReport {
  readonly generatedAt: string;
  readonly phase: "8.11B";
  readonly releaseId: string;
  readonly providerLookup: "PASS" | "FAIL";
  readonly variantLookup: "PASS" | "FAIL";
  readonly licenseLookup: "PASS" | "FAIL";
  readonly attributionLookup: "PASS" | "FAIL";
  readonly productionMapping: "PASS" | "FAIL";
  readonly featureFlag: "PASS" | "FAIL";
  readonly immutability: "PASS" | "FAIL";
  readonly noExternalDependency: "PASS" | "FAIL";
  readonly performance: "PASS" | "FAIL";
  readonly checksumVerification: "PASS" | "FAIL";
  readonly status: "PASS" | "FAIL";
}

export interface ArtworkIntegrationManifest {
  readonly generatedAt: string;
  readonly phase: "8.11B";
  readonly releaseId: string;
  readonly featureFlags: {
    readonly masterArtworkEnabled: false;
    readonly artworkProviderPreference: ArtworkProviderPreference;
  };
  readonly outputs: {
    readonly artworkProductionCoverage: string;
    readonly artworkProviderCoverage: string;
    readonly artworkIntegrationAudit: string;
  };
}
