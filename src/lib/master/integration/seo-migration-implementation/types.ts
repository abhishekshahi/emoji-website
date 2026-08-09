export const APPROVED_REDIRECT_BASELINE = 2280 as const;
export const PRESERVED_URL_BASELINE = 644 as const;
export const EXCLUDED_URL_BASELINE = 10 as const;
export const REDIRECT_HTTP_STATUS = 301 as const;

export interface ApprovedRedirectRecord {
  readonly from: string;
  readonly to: string;
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly decision: "SAFE_TO_REDIRECT";
  readonly reason: string;
  readonly permanent: true;
}

export interface ApprovedRedirectsDataset {
  readonly generatedAt: string;
  readonly phase: "8.12C";
  readonly releaseId: string;
  readonly count: number;
  readonly redirects: readonly ApprovedRedirectRecord[];
}
