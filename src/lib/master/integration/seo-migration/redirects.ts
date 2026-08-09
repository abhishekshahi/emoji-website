import approvedRedirectsDataset from "@/data/master/integration/seo-migration-review/approved-redirects.json";
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

const redirectByFrom = new Map<string, ApprovedRedirectRecord>();
const productionSlugByTarget = new Map<string, string>();
const redirectSourceSlugs = new Set<string>();
const redirectTargetSlugs = new Set<string>();
const canonicalIdByTarget = new Map<string, string>();

for (const record of approvedRedirectsDataset.redirects as ApprovedRedirectRecord[]) {
  redirectByFrom.set(record.from, record);
  const sourceSlug = record.from.replace("/emoji/", "");
  const targetSlug = record.to.replace("/emoji/", "");
  redirectSourceSlugs.add(sourceSlug);
  redirectTargetSlugs.add(targetSlug);
  productionSlugByTarget.set(targetSlug, sourceSlug);
  canonicalIdByTarget.set(targetSlug, record.canonicalId);
}

if (redirectByFrom.size !== APPROVED_REDIRECT_BASELINE) {
  throw new Error(
    `Approved redirect dataset must contain exactly ${APPROVED_REDIRECT_BASELINE} redirects (found ${redirectByFrom.size}).`,
  );
}

export function resolveApprovedEmojiRedirect(pathname: string): ResolvedApprovedRedirect | null {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const record = redirectByFrom.get(normalized);
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
  return redirectSourceSlugs.has(slug);
}

export function isApprovedRedirectTargetSlug(slug: string): boolean {
  return redirectTargetSlugs.has(slug);
}

export function resolveProductionSlugForRedirectTarget(slug: string): string | null {
  return productionSlugByTarget.get(slug) ?? null;
}

export function getCanonicalIdForRedirectTarget(slug: string): string | null {
  return canonicalIdByTarget.get(slug) ?? null;
}

export function getApprovedRedirectRecords(): readonly ApprovedRedirectRecord[] {
  return approvedRedirectsDataset.redirects as ApprovedRedirectRecord[];
}

export function getApprovedRedirectSourceSlugs(): ReadonlySet<string> {
  return redirectSourceSlugs;
}

export function getApprovedRedirectTargetSlugs(): ReadonlySet<string> {
  return redirectTargetSlugs;
}

export function getCanonicalEmojiSitemapSlugs(productionSlugs: readonly string[]): string[] {
  const canonical: string[] = [];
  for (const slug of productionSlugs) {
    if (!redirectSourceSlugs.has(slug)) {
      canonical.push(slug);
    }
  }
  for (const targetSlug of redirectTargetSlugs) {
    canonical.push(targetSlug);
  }
  return canonical;
}

export function resolveEmojiPageSlug(slug: string): {
  readonly lookupSlug: string;
  readonly canonicalSlug: string;
} {
  const productionAlias = productionSlugByTarget.get(slug);
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
  const sample = (approvedRedirectsDataset.redirects as ApprovedRedirectRecord[])[0]?.from ?? "/emoji/keycap";
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
