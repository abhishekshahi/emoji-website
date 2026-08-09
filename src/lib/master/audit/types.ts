export type AuditStatus = "PASS" | "FAIL" | "WARN";

export interface AuditCheck {
  id: string;
  name: string;
  status: AuditStatus;
  expected?: string | number;
  actual?: string | number;
  detail?: string;
  affectedRecords?: string[];
}

export interface AuditSection {
  name: string;
  status: AuditStatus;
  checks: AuditCheck[];
}

export interface MasterIntegrityReport {
  generatedAt: string;
  phase: "8.9";
  overallStatus: AuditStatus;
  sections: AuditSection[];
  summary: {
    pass: number;
    fail: number;
    warn: number;
  };
}

export interface MasterCountAudit {
  generatedAt: string;
  phase: "8.9";
  baselines: Record<string, number>;
  calculated: Record<string, number>;
  reported: Record<string, number>;
  mismatches: Array<{ metric: string; expected: number; calculated: number; reported?: number }>;
  status: AuditStatus;
}

export interface MasterReferenceIntegrity {
  generatedAt: string;
  phase: "8.9";
  totals: {
    validReferences: number;
    missingReferences: number;
    orphanReferences: number;
    invalidReferences: number;
  };
  issues: Array<{
    kind: "missing" | "orphan" | "invalid";
    layer: string;
    canonicalId?: string;
    reference?: string;
    detail: string;
  }>;
  status: AuditStatus;
}

export interface MasterProvenanceAudit {
  generatedAt: string;
  phase: "8.9";
  derivedLayersChecked: string[];
  untraceableValues: number;
  issues: Array<{ layer: string; canonicalId: string; field: string; detail: string }>;
  status: AuditStatus;
}

export interface MasterLicenseAudit {
  generatedAt: string;
  phase: "8.9";
  artworkLicenses: Record<string, { expected: string; actual: string; status: AuditStatus }>;
  metadataLicenses: Record<string, { expected: string; actual: string; status: AuditStatus }>;
  unknownLicenses: string[];
  status: AuditStatus;
}

export interface MasterVersionAudit {
  generatedAt: string;
  phase: "8.9";
  sources: Array<{
    source: string;
    lockVersion: string;
    storedVersion: string | null;
    lockCommit: string | null;
    storedCommit: string | null;
    status: AuditStatus;
    detail: string;
  }>;
  status: AuditStatus;
}

export interface MasterDataLossAudit {
  generatedAt: string;
  phase: "8.9";
  transitions: Array<{
    from: string;
    to: string;
    metric: string;
    before: number;
    after: number;
    acceptable: boolean;
    status: AuditStatus;
    detail: string;
  }>;
  status: AuditStatus;
}

export interface MasterProductionSafetyAudit {
  generatedAt: string;
  phase: "8.9";
  productionFiles: Array<{ path: string; recordCount: number; status: AuditStatus }>;
  protectedPaths: Array<{ path: string; exists: boolean; modified: boolean }>;
  status: AuditStatus;
}

export interface EmojiSpotCheck {
  emoji: string;
  label: string;
  canonicalId: string | null;
  identity: AuditStatus;
  artwork: AuditStatus;
  metadata: AuditStatus;
  semantics: AuditStatus;
  search: AuditStatus;
  seo: AuditStatus;
  detail?: string;
}

export interface Phase89AuditResult {
  integrityReport: MasterIntegrityReport;
  countAudit: MasterCountAudit;
  referenceIntegrity: MasterReferenceIntegrity;
  provenanceAudit: MasterProvenanceAudit;
  licenseAudit: MasterLicenseAudit;
  versionAudit: MasterVersionAudit;
  dataLossAudit: MasterDataLossAudit;
  productionSafetyAudit: MasterProductionSafetyAudit;
  emojiSpotChecks: EmojiSpotCheck[];
}
