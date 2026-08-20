import type { LicenseRecord, LicenseStatus, SourceRecord } from "../types";
import { KAOMOJI_SOURCE_REGISTRY, listCollectionEnabledSources } from "./registry";

const STATUS_RESTRICTIVENESS: Readonly<Record<LicenseStatus, number>> = {
  APPROVED: 1,
  ATTRIBUTION_REQUIRED: 2,
  UNKNOWN: 3,
  REVIEW_REQUIRED: 4,
  NOT_PERMITTED: 5,
};

function sourceToLicenseRecord(source: SourceRecord): LicenseRecord {
  const evidence: string[] = [];
  if (source.license_url) evidence.push(`license_url:${source.license_url}`);
  if (source.terms_url) evidence.push(`terms_url:${source.terms_url}`);
  if (source.license_name) evidence.push(`license_name:${source.license_name}`);
  evidence.push(`verification_status:${source.verification_status}`);

  const restrictions: string[] = [];
  if (source.attribution_required) restrictions.push("attribution_required");
  if (source.license_status === "NOT_PERMITTED") restrictions.push("not_permitted");

  return {
    source_id: source.source_id,
    license_status: source.license_status,
    license_name: source.license_name,
    commercial_use: source.commercial_use,
    redistribution: source.redistribution,
    modification: source.modification,
    attribution_required: source.attribution_required,
    terms_url: source.terms_url,
    license_url: source.license_url,
    verification_date: source.verification_date,
    evidence,
    confidence:
      source.verification_status === "VERIFIED"
        ? "high"
        : source.verification_status === "PARTIALLY_VERIFIED"
          ? "medium"
          : "low",
    restrictions,
    notes: [...source.notes],
  };
}

/** Build license audit records for every registered source. */
export function buildLicenseAuditRecords(): LicenseRecord[] {
  return KAOMOJI_SOURCE_REGISTRY.map(sourceToLicenseRecord);
}

export interface LicenseStatusSummary {
  readonly total: number;
  readonly collection_enabled: number;
  readonly publication_enabled: number;
  readonly by_status: Readonly<Partial<Record<LicenseStatus, number>>>;
}

/** Summarize license statuses across the registry. */
export function summarizeLicenseStatuses(
  records: readonly LicenseRecord[] = buildLicenseAuditRecords(),
): LicenseStatusSummary {
  const by_status: Partial<Record<LicenseStatus, number>> = {};
  for (const record of records) {
    by_status[record.license_status] = (by_status[record.license_status] ?? 0) + 1;
  }

  return {
    total: records.length,
    collection_enabled: listCollectionEnabledSources().length,
    publication_enabled: KAOMOJI_SOURCE_REGISTRY.filter((s) => s.enabled_for_publication).length,
    by_status,
  };
}

/** Pick the most restrictive license status when merging multi-source candidates. */
export function mergeLicenseStatuses(statuses: readonly LicenseStatus[]): LicenseStatus {
  if (statuses.length === 0) return "UNKNOWN";
  return statuses.reduce((worst, status) =>
    STATUS_RESTRICTIVENESS[status] > STATUS_RESTRICTIVENESS[worst] ? status : worst,
  );
}
