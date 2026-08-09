export type MasterSearchMatchedField =
  | "emoji"
  | "unicode"
  | "hexcode"
  | "shortcode"
  | "canonical-name"
  | "alias"
  | "keyword"
  | "semantic";

export interface MasterSearchProvenance {
  readonly term: string;
  readonly source: string;
  readonly canonicalId: string;
  readonly sourceVersion?: string;
  readonly sourceRecordRef?: string;
}

export interface MasterSearchIntegrationResult {
  readonly canonicalId: string;
  readonly character: string | null;
  readonly canonicalName: string;
  readonly matchedField: MasterSearchMatchedField;
  readonly matchedTerm: string;
  readonly score: number;
  readonly source: string;
  readonly isExtra: boolean;
  readonly confidence: number;
  readonly productionId: string | null;
  readonly productionHexcode: string | null;
  readonly provenance: MasterSearchProvenance;
}

export interface MasterSearchIntegrationResponse {
  readonly query: string;
  readonly results: readonly MasterSearchIntegrationResult[];
  readonly ambiguous: boolean;
}

export interface SearchProductionCoverageEntry {
  readonly query: string;
  readonly topCanonicalId: string | null;
  readonly topProductionHexcode: string | null;
  readonly resultCount: number;
  readonly ambiguous: boolean;
}

export interface SearchProductionCoverageReport {
  readonly generatedAt: string;
  readonly phase: "8.11C";
  readonly releaseId: string;
  readonly entries: readonly SearchProductionCoverageEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface SearchRankingAuditReport {
  readonly generatedAt: string;
  readonly phase: "8.11C";
  readonly releaseId: string;
  readonly checks: {
    readonly exactEmojiOutranksSemantic: "PASS" | "FAIL";
    readonly exactShortcodeOutranksKeyword: "PASS" | "FAIL";
    readonly standardPreferredOverExtra: "PASS" | "FAIL";
    readonly ambiguousHotRestricted: "PASS" | "FAIL";
  };
  readonly status: "PASS" | "FAIL";
}

export interface SearchIntegrationAuditReport {
  readonly generatedAt: string;
  readonly phase: "8.11C";
  readonly releaseId: string;
  readonly searchIntegration: "PASS" | "FAIL";
  readonly ambiguityProtection: "PASS" | "FAIL";
  readonly shortcodeResolution: "PASS" | "FAIL";
  readonly featureFlag: "PASS" | "FAIL";
  readonly productionMapping: "PASS" | "FAIL";
  readonly noExternalDependency: "PASS" | "FAIL";
  readonly performance: "PASS" | "FAIL";
  readonly status: "PASS" | "FAIL";
}

export interface SearchIntegrationManifest {
  readonly generatedAt: string;
  readonly phase: "8.11C";
  readonly releaseId: string;
  readonly featureFlags: {
    readonly masterMetadataEnabled: false;
    readonly masterSearchEnabled: false;
  };
  readonly outputs: {
    readonly searchProductionCoverage: string;
    readonly searchRankingAudit: string;
    readonly searchIntegrationAudit: string;
  };
}
