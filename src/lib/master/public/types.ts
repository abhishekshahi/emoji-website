import type { ArtworkProvider } from "@/lib/master/canonical/types";
import type { PublicVisibilityMatrix } from "./visibility";

export interface PublicArtworkProviderInfo {
  readonly provider: ArtworkProvider;
  readonly label: string;
  readonly format: string;
  readonly license: string;
  readonly licenseURL: string;
  readonly attribution: string | null;
  readonly publicServingAllowed: boolean;
  readonly downloadAllowed: boolean;
  readonly artworkUrl: string | null;
  readonly status: "public" | "restricted" | "unavailable";
  readonly message: string | null;
}

export interface PublicIdentityResponse {
  readonly canonicalId: string;
  readonly glyph: string | null;
  readonly unicodeSequence: string | null;
  readonly hexcode: string | null;
  readonly officialName: string;
  readonly identityType: string;
  readonly identityTypeLabel: string;
  readonly aliases: readonly string[];
  readonly keywords: readonly string[];
  readonly definitions: readonly string[];
  readonly semanticTerms: readonly string[];
  readonly category: string | null;
  readonly subcategory: string | null;
  readonly variants: readonly string[];
  readonly related: readonly string[];
  readonly artworkProviders: readonly PublicArtworkProviderInfo[];
  readonly visibility: PublicVisibilityMatrix;
  readonly seoPageUrl: string | null;
  readonly catalogUrl: string;
  readonly provenance: readonly { source: string; field: string }[];
}

export interface PublicDataManifest {
  readonly version: string;
  readonly generatedAt: string;
  readonly releaseId: string;
  readonly totals: {
    readonly identities: number;
    readonly artworkRecords: number;
    readonly publicIdentities: number;
    readonly indexableIdentities: number;
  };
  readonly downloads: readonly {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly license: string;
    readonly available: boolean;
    readonly path: string | null;
  }[];
  readonly checksum: string | null;
}
