import type { ApprovedRedirectRecord } from "../seo-migration-implementation/types";
import {
  APPROVED_REDIRECT_BASELINE,
  REDIRECT_HTTP_STATUS,
} from "../seo-migration-implementation/types";

export { APPROVED_REDIRECT_BASELINE, REDIRECT_HTTP_STATUS };

export interface ResolvedApprovedRedirect {
  readonly to: string;
  readonly canonicalId: string;
  readonly permanent: true;
  readonly status: typeof REDIRECT_HTTP_STATUS;
}

interface ApprovedRedirectsDataset {
  readonly redirects: readonly ApprovedRedirectRecord[];
}

let redirectByFrom: Map<string, ApprovedRedirectRecord> | null = null;
let productionSlugByTarget: Map<string, string> | null = null;
let redirectSourceSlugs: Set<string> | null = null;
let redirectTargetSlugs: Set<string> | null = null;
let canonicalIdByTarget: Map<string, string> | null = null;
let approvedRedirectsDataset: ApprovedRedirectsDataset | null = null;

function ensureRedirectIndex(): void {
  if (redirectByFrom !== null) {
    return;
  }

  // Lazy load keeps the ~834 KB dataset out of OFF-mode Worker bundles.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  approvedRedirectsDataset = require("@/data/master/integration/seo-migration-review/approved-redirects.json") as ApprovedRedirectsDataset;

  const byFrom = new Map<string, ApprovedRedirectRecord>();
  const slugByTarget = new Map<string, string>();
  const sourceSlugs = new Set<string>();
  const targetSlugs = new Set<string>();
  const canonicalByTarget = new Map<string, string>();

  for (const record of approvedRedirectsDataset.redirects) {
    byFrom.set(record.from, record);
    const sourceSlug = record.from.replace("/emoji/", "");
    const targetSlug = record.to.replace("/emoji/", "");
    sourceSlugs.add(sourceSlug);
    targetSlugs.add(targetSlug);
    slugByTarget.set(targetSlug, sourceSlug);
    canonicalByTarget.set(targetSlug, record.canonicalId);
  }

  if (byFrom.size !== APPROVED_REDIRECT_BASELINE) {
    throw new Error(
      `Approved redirect dataset must contain exactly ${APPROVED_REDIRECT_BASELINE} redirects (found ${byFrom.size}).`,
    );
  }

  redirectByFrom = byFrom;
  productionSlugByTarget = slugByTarget;
  redirectSourceSlugs = sourceSlugs;
  redirectTargetSlugs = targetSlugs;
  canonicalIdByTarget = canonicalByTarget;
}

export function resolveApprovedEmojiRedirect(pathname: string): ResolvedApprovedRedirect | null {
  ensureRedirectIndex();
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const record = redirectByFrom!.get(normalized);
  if (!record) {
    return null;
  }
  return Object.freeze({
    to: record.to,
    canonicalId: record.canonicalId,
    permanent: true,
    status: REDIRECT_HTTP_STATUS,
  });
}

export function isApprovedRedirectSourceSlug(slug: string): boolean {
  ensureRedirectIndex();
  return redirectSourceSlugs!.has(slug);
}

export function isApprovedRedirectTargetSlug(slug: string): boolean {
  ensureRedirectIndex();
  return redirectTargetSlugs!.has(slug);
}

export function resolveProductionSlugForRedirectTarget(slug: string): string | null {
  ensureRedirectIndex();
  return productionSlugByTarget!.get(slug) ?? null;
}

export function getCanonicalIdForRedirectTarget(slug: string): string | null {
  ensureRedirectIndex();
  return canonicalIdByTarget!.get(slug) ?? null;
}

export function getApprovedRedirectRecords(): readonly ApprovedRedirectRecord[] {
  ensureRedirectIndex();
  return approvedRedirectsDataset!.redirects;
}

export function getApprovedRedirectSourceSlugs(): ReadonlySet<string> {
  ensureRedirectIndex();
  return redirectSourceSlugs!;
}

export function getApprovedRedirectTargetSlugs(): ReadonlySet<string> {
  ensureRedirectIndex();
  return redirectTargetSlugs!;
}

export function getCanonicalEmojiSitemapSlugs(productionSlugs: readonly string[]): string[] {
  ensureRedirectIndex();
  const canonical: string[] = [];
  for (const slug of productionSlugs) {
    if (!redirectSourceSlugs!.has(slug)) {
      canonical.push(slug);
    }
  }
  for (const targetSlug of redirectTargetSlugs!) {
    canonical.push(targetSlug);
  }
  return canonical;
}

export function resolveEmojiPageSlug(slug: string): {
  readonly lookupSlug: string;
  readonly canonicalSlug: string;
} {
  ensureRedirectIndex();
  const productionAlias = productionSlugByTarget!.get(slug);
  if (productionAlias) {
    return Object.freeze({
      lookupSlug: productionAlias,
      canonicalSlug: slug,
    });
  }
  return Object.freeze({
    lookupSlug: slug,
    canonicalSlug: slug,
  });
}

export function measureRedirectLookupPerformance(): {
  readonly coldLookupMs: number;
  readonly warmLookupMs: number;
  readonly lookupComplexity: "O(1)";
} {
  ensureRedirectIndex();
  const sample = approvedRedirectsDataset!.redirects[0]?.from ?? "/emoji/keycap";
  const coldStart = performance.now();
  resolveApprovedEmojiRedirect(sample);
  const coldMs = performance.now() - coldStart;

  const warmStart = performance.now();
  for (let index = 0; index < 1000; index += 1) {
    resolveApprovedEmojiRedirect(sample);
  }
  const warmMs = (performance.now() - warmStart) / 1000;

  return Object.freeze({
    coldLookupMs: coldMs,
    warmLookupMs: warmMs,
    lookupComplexity: "O(1)",
  });
}
