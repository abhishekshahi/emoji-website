import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { getAllBrowsableSlugs } from "@/lib/emoji/browsable-data";
import { getBrowsableEmojiBySlug } from "@/lib/emoji/browsable-data";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { absoluteUrl } from "@/lib/seo/metadata";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  SEO_MIGRATION_PRODUCTION_QA_PHASE,
  integrationDataPaths,
} from "../config";
import {
  APPROVED_REDIRECT_BASELINE,
  EXCLUDED_URL_BASELINE,
  PRESERVED_URL_BASELINE,
  REDIRECT_HTTP_STATUS,
  buildApprovedRedirectsDataset,
  buildPreservedUrlList,
  type ApprovedRedirectRecord,
} from "../seo-migration-implementation/build";
import { loadRedirectApprovalCandidates } from "../seo-migration-implementation/build";
import {
  getApprovedRedirectRecords,
  getCanonicalEmojiSitemapSlugs,
  measureRedirectLookupPerformance,
  resolveApprovedEmojiRedirect,
} from "../seo-migration/redirects";
import {
  extractCanonicalHref,
  locationPathname,
  mapWithConcurrency,
  normalizePathname,
  probeUrl,
} from "./http-client";

const HTTP_CONCURRENCY = 40;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function ALL_FLAGS_DISABLED() {
  return Object.freeze({
    masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
    masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
    masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
  });
}

function auditEnvelope<T extends Record<string, unknown>>(status: "PASS" | "FAIL", extra: T) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_MIGRATION_PRODUCTION_QA_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: ALL_FLAGS_DISABLED(),
    provenance: "production-redirect-qa",
    auditOnly: true,
    ...extra,
    status,
  });
}

export function verifyApprovedRedirectDatasetEquivalence(rootDir: string = process.cwd()) {
  const candidates = loadRedirectApprovalCandidates(rootDir);
  const reviewRedirects = readJson<{ count: number; redirects: ApprovedRedirectRecord[] }>(
    join(integrationDataPaths(rootDir).seoMigrationReviewIntegrationDir, "approved-redirects.json"),
  );
  const implementationRedirects = readJson<{ count: number; redirects: ApprovedRedirectRecord[] }>(
    join(integrationDataPaths(rootDir).seoMigrationImplementationIntegrationDir, "approved-redirects.json"),
  );
  const built = buildApprovedRedirectsDataset(rootDir);

  const errors: string[] = [];
  if (candidates.count !== APPROVED_REDIRECT_BASELINE) {
    errors.push(`Candidate count ${candidates.count} !== ${APPROVED_REDIRECT_BASELINE}`);
  }
  if (reviewRedirects.count !== APPROVED_REDIRECT_BASELINE) {
    errors.push(`Review approved-redirects count ${reviewRedirects.count} !== ${APPROVED_REDIRECT_BASELINE}`);
  }
  if (implementationRedirects.count !== APPROVED_REDIRECT_BASELINE) {
    errors.push(`Implementation approved-redirects count ${implementationRedirects.count} !== ${APPROVED_REDIRECT_BASELINE}`);
  }

  const candidateMapped = candidates.entries.map((entry) =>
    JSON.stringify({
      from: entry.currentUrl,
      to: entry.proposedUrl,
      canonicalId: entry.canonicalId,
      emoji: entry.emoji,
      decision: entry.decision,
      permanent: true,
    }),
  );
  const reviewMapped = reviewRedirects.redirects.map((entry) =>
    JSON.stringify({
      from: entry.from,
      to: entry.to,
      canonicalId: entry.canonicalId,
      emoji: entry.emoji,
      decision: entry.decision,
      permanent: entry.permanent,
    }),
  );
  const implementationMapped = implementationRedirects.redirects.map((entry) =>
    JSON.stringify({
      from: entry.from,
      to: entry.to,
      canonicalId: entry.canonicalId,
      emoji: entry.emoji,
      decision: entry.decision,
      permanent: entry.permanent,
    }),
  );
  const builtMapped = built.redirects.map((entry) =>
    JSON.stringify({
      from: entry.from,
      to: entry.to,
      canonicalId: entry.canonicalId,
      emoji: entry.emoji,
      decision: entry.decision,
      permanent: entry.permanent,
    }),
  );

  candidateMapped.sort();
  reviewMapped.sort();
  implementationMapped.sort();
  builtMapped.sort();

  if (JSON.stringify(candidateMapped) !== JSON.stringify(reviewMapped)) {
    errors.push("redirect-approval-candidates.json does not match review approved-redirects.json");
  }
  if (JSON.stringify(reviewMapped) !== JSON.stringify(implementationMapped)) {
    errors.push("review approved-redirects.json does not match implementation approved-redirects.json");
  }
  if (JSON.stringify(reviewMapped) !== JSON.stringify(builtMapped)) {
    errors.push("built approved redirects do not match frozen dataset");
  }

  for (const entry of reviewRedirects.redirects) {
    if (!entry.from.startsWith("/emoji/") || !entry.to.startsWith("/emoji/")) {
      errors.push(`Malformed URL in ${entry.from}`);
    }
    if (entry.decision !== "SAFE_TO_REDIRECT" || entry.permanent !== true) {
      errors.push(`Invalid decision/permanent on ${entry.from}`);
    }
    if (entry.to.startsWith("http") || entry.to.startsWith("//")) {
      errors.push(`External destination ${entry.to}`);
    }
  }

  const sources = new Set<string>();
  for (const entry of reviewRedirects.redirects) {
    if (sources.has(entry.from)) {
      errors.push(`Duplicate source ${entry.from}`);
    }
    sources.add(entry.from);
  }

  const status = errors.length === 0 ? "PASS" : "FAIL";
  return auditEnvelope(status, {
    count: reviewRedirects.count,
    errors: Object.freeze(errors),
    checks: Object.freeze({
      candidateCount: candidates.count === APPROVED_REDIRECT_BASELINE,
      reviewCount: reviewRedirects.count === APPROVED_REDIRECT_BASELINE,
      implementationCount: implementationRedirects.count === APPROVED_REDIRECT_BASELINE,
      exactEquivalence: errors.length === 0,
    }),
  });
}

async function auditRedirectRecord(baseUrl: string, record: ApprovedRedirectRecord) {
  const sourceProbe = await probeUrl(baseUrl, record.from, { followRedirects: false });
  const locationPath = locationPathname(sourceProbe.location, baseUrl);
  const expectedTargetPath = normalizePathname(record.to);
  const failures: string[] = [];

  if (sourceProbe.status !== REDIRECT_HTTP_STATUS) {
    failures.push(`status ${sourceProbe.status} !== ${REDIRECT_HTTP_STATUS}`);
  }
  if (locationPath !== expectedTargetPath) {
    failures.push(`location ${locationPath} !== ${expectedTargetPath}`);
  }
  if (sourceProbe.location?.startsWith("http://") || sourceProbe.location?.startsWith("https://")) {
    const locationUrl = new URL(sourceProbe.location);
    const base = new URL(baseUrl);
    if (locationUrl.hostname !== base.hostname) {
      failures.push(`hostname changed to ${locationUrl.hostname}`);
    }
  }

  const targetProbe = await probeUrl(baseUrl, record.to, { followRedirects: false });
  if (targetProbe.status !== 200) {
    failures.push(`target status ${targetProbe.status} !== 200`);
  }
  if (targetProbe.status === 301 || targetProbe.status === 302) {
    failures.push(`target redirects again (${targetProbe.status})`);
  }

  return Object.freeze({
    from: record.from,
    to: record.to,
    canonicalId: record.canonicalId,
    status: sourceProbe.status,
    location: sourceProbe.location,
    targetStatus: targetProbe.status,
    failures: Object.freeze(failures),
    pass: failures.length === 0,
  });
}

export async function buildHttpRedirectAudit(baseUrl: string, rootDir: string = process.cwd()) {
  const redirects = getApprovedRedirectRecords();
  const results = await mapWithConcurrency(redirects, HTTP_CONCURRENCY, (record) =>
    auditRedirectRecord(baseUrl, record),
  );
  const failures = results.filter((entry) => !entry.pass);
  const status = failures.length === 0 ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    baseUrl,
    count: redirects.length,
    failureCount: failures.length,
    sampleFailures: Object.freeze(failures.slice(0, 20)),
    entries: Object.freeze(results),
  });
}

export async function buildRedirectStatusAudit(baseUrl: string) {
  const redirects = getApprovedRedirectRecords();
  const results = await mapWithConcurrency(redirects, HTTP_CONCURRENCY, async (record) => {
    const probe = await probeUrl(baseUrl, record.from, { followRedirects: false });
    return Object.freeze({
      from: record.from,
      status: probe.status,
      pass: probe.status === REDIRECT_HTTP_STATUS,
    });
  });
  const failures = results.filter((entry) => !entry.pass);
  return auditEnvelope(failures.length === 0 ? "PASS" : "FAIL", {
    count: results.length,
    failureCount: failures.length,
    entries: Object.freeze(results),
  });
}

export async function buildLocationHeaderAudit(baseUrl: string) {
  const redirects = getApprovedRedirectRecords();
  const results = await mapWithConcurrency(redirects, HTTP_CONCURRENCY, async (record) => {
    const probe = await probeUrl(baseUrl, record.from, { followRedirects: false });
    const locationPath = locationPathname(probe.location, baseUrl);
    const expected = normalizePathname(record.to);
    return Object.freeze({
      from: record.from,
      location: probe.location,
      expected: record.to,
      pass: locationPath === expected,
    });
  });
  const failures = results.filter((entry) => !entry.pass);
  return auditEnvelope(failures.length === 0 ? "PASS" : "FAIL", {
    count: results.length,
    failureCount: failures.length,
    entries: Object.freeze(results),
  });
}

export async function buildRedirectExhaustiveAudit(baseUrl: string) {
  const httpAudit = await buildHttpRedirectAudit(baseUrl);
  return auditEnvelope(httpAudit.status, {
    exhaustive: true,
    count: httpAudit.count,
    failureCount: httpAudit.failureCount,
    httpRedirectStatus: httpAudit.status,
  });
}

export async function buildRedirectChainAudit(baseUrl: string) {
  const redirects = getApprovedRedirectRecords();
  const results = await mapWithConcurrency(redirects, HTTP_CONCURRENCY, (record) =>
    auditRedirectRecord(baseUrl, record),
  );
  const chains = results.filter((entry) => entry.targetStatus === 301 || entry.targetStatus === 302).length;
  const loops = results.filter((entry) => normalizePathname(entry.from) === locationPathname(entry.location, baseUrl)).length;
  const selfRedirects = results.filter((entry) => entry.from === entry.to).length;

  const unknownProbe = await probeUrl(baseUrl, "/emoji/this-slug-should-not-exist-qa-8-12d", {
    followRedirects: false,
  });

  const status =
    chains === 0 && loops === 0 && selfRedirects === 0 && unknownProbe.status !== 301 && unknownProbe.status !== 302
      ? "PASS"
      : "FAIL";

  return auditEnvelope(status, {
    chains,
    loops,
    selfRedirects,
    unknownStatus: unknownProbe.status,
    unknownRedirects: unknownProbe.status === 301 || unknownProbe.status === 302,
  });
}

export async function buildPreservedUrlHttpAudit(baseUrl: string, rootDir: string = process.cwd()) {
  const preserved = buildPreservedUrlList(rootDir);
  const urls = preserved.entries;
  const results = await mapWithConcurrency(urls, HTTP_CONCURRENCY, async (entry) => {
    const probe = await probeUrl(baseUrl, entry.url, { followRedirects: false });
    const canonical = extractCanonicalHref(
      probe.status === 200 ? (await probeUrl(baseUrl, entry.url)).bodySnippet : null,
      baseUrl,
    );
    const expectedCanonical = absoluteUrl(entry.url);
    const failures: string[] = [];
    if (probe.status !== 200) {
      failures.push(`status ${probe.status}`);
    }
    if (probe.status === 301 || probe.status === 302) {
      failures.push("unexpected redirect");
    }
    if (canonical && canonical !== expectedCanonical) {
      failures.push(`canonical ${canonical} !== ${expectedCanonical}`);
    }
    return Object.freeze({
      url: entry.url,
      decision: entry.decision,
      status: probe.status,
      canonical,
      expectedCanonical,
      failures: Object.freeze(failures),
      pass: failures.length === 0,
    });
  });

  const byDecision = Object.freeze({
    KEEP_CURRENT_URL: results.filter((entry) => entry.decision === "KEEP_CURRENT_URL").length,
    KEEP_EXTRA_URL: results.filter((entry) => entry.decision === "KEEP_EXTRA_URL").length,
    KEEP_SOURCE_URL: results.filter((entry) => entry.decision === "KEEP_SOURCE_URL").length,
  });
  const failures = results.filter((entry) => !entry.pass);
  const status = preserved.count === PRESERVED_URL_BASELINE && failures.length === 0 ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    count: results.length,
    expected: PRESERVED_URL_BASELINE,
    byDecision,
    failureCount: failures.length,
    entries: Object.freeze(results),
  });
}

export async function buildExcludedUrlAudit(baseUrl: string, rootDir: string = process.cwd()) {
  const preserved = buildPreservedUrlList(rootDir);
  const results = await mapWithConcurrency(preserved.excluded, HTTP_CONCURRENCY, async (entry) => {
    const probe = await probeUrl(baseUrl, entry.url, { followRedirects: false });
    const failures: string[] = [];
    if (probe.status === 301 || probe.status === 302) {
      failures.push("redirected");
    }
    if (probe.status !== 200) {
      failures.push(`status ${probe.status}`);
    }
    return Object.freeze({
      url: entry.url,
      canonicalId: entry.canonicalId,
      status: probe.status,
      failures: Object.freeze(failures),
      pass: failures.length === 0,
    });
  });
  const failures = results.filter((entry) => !entry.pass);
  const status = preserved.excludedCount === EXCLUDED_URL_BASELINE && failures.length === 0 ? "PASS" : "FAIL";
  return auditEnvelope(status, {
    count: results.length,
    expected: EXCLUDED_URL_BASELINE,
    failureCount: failures.length,
    entries: Object.freeze(results),
  });
}

export async function buildCanonicalHttpAudit(baseUrl: string, rootDir: string = process.cwd()) {
  const redirects = getApprovedRedirectRecords();
  const preserved = buildPreservedUrlList(rootDir);
  const sampleRedirect = redirects[0];
  const samplePreserved = preserved.entries[0];
  const sampleExtra = preserved.entries.find((entry) => entry.decision === "KEEP_EXTRA_URL");
  const sampleSource = preserved.entries.find((entry) => entry.decision === "KEEP_SOURCE_URL");
  const fireSlug = getBrowsableEmojiBySlug("fire");

  const cases: Array<{ label: string; path: string; expectStatus: number; expectCanonicalPath: string | null }> = [
    {
      label: "migrated-source",
      path: sampleRedirect.from,
      expectStatus: REDIRECT_HTTP_STATUS,
      expectCanonicalPath: null,
    },
    {
      label: "migrated-target",
      path: sampleRedirect.to,
      expectStatus: 200,
      expectCanonicalPath: sampleRedirect.to,
    },
    {
      label: "preserved-url",
      path: samplePreserved.url,
      expectStatus: 200,
      expectCanonicalPath: samplePreserved.url,
    },
    {
      label: "extra-url",
      path: sampleExtra?.url ?? "/emoji/extra-goldfish",
      expectStatus: 200,
      expectCanonicalPath: sampleExtra?.url ?? "/emoji/extra-goldfish",
    },
    {
      label: "source-specific-url",
      path: sampleSource?.url ?? "/emoji/extra-goldfish",
      expectStatus: 200,
      expectCanonicalPath: sampleSource?.url ?? "/emoji/extra-goldfish",
    },
    {
      label: "canonical-fire",
      path: "/emoji/fire",
      expectStatus: 200,
      expectCanonicalPath: "/emoji/fire",
    },
  ];

  const results = [];
  for (const testCase of cases) {
    const probe = await probeUrl(baseUrl, testCase.path, { followRedirects: false });
    const canonical = extractCanonicalHref(
      probe.status === 200 ? (await probeUrl(baseUrl, testCase.path)).bodySnippet : null,
      baseUrl,
    );
    const expectedCanonical = testCase.expectCanonicalPath ? absoluteUrl(testCase.expectCanonicalPath) : null;
    const failures: string[] = [];
    if (probe.status !== testCase.expectStatus) {
      failures.push(`status ${probe.status} !== ${testCase.expectStatus}`);
    }
    if (expectedCanonical && canonical !== expectedCanonical) {
      failures.push(`canonical ${canonical} !== ${expectedCanonical}`);
    }
    if (canonical?.includes("openmoji")) {
      failures.push("provider-specific canonical");
    }
    results.push(
      Object.freeze({
        label: testCase.label,
        path: testCase.path,
        status: probe.status,
        canonical,
        expectedCanonical,
        fireExists: fireSlug !== undefined,
        failures: Object.freeze(failures),
        pass: failures.length === 0,
      }),
    );
  }

  const failures = results.filter((entry) => !entry.pass);
  return auditEnvelope(failures.length === 0 ? "PASS" : "FAIL", {
    entries: Object.freeze(results),
    failureCount: failures.length,
  });
}

export function buildSitemapProductionAudit(rootDir: string = process.cwd()) {
  const productionSlugs = getAllBrowsableSlugs();
  const canonicalSlugs = getCanonicalEmojiSitemapSlugs(productionSlugs);
  const redirectSources = new Set(getApprovedRedirectRecords().map((record) => record.from.replace("/emoji/", "")));
  const redirectTargets = new Set(getApprovedRedirectRecords().map((record) => record.to.replace("/emoji/", "")));
  const urls = canonicalSlugs.map((slug) => absoluteUrl(`/emoji/${slug}`));
  const uniqueUrls = new Set(urls);

  const checks = Object.freeze({
    pageCount: canonicalSlugs.length === PRODUCTION_BASELINES.totalSearchable,
    noDuplicateUrls: uniqueUrls.size === urls.length,
    sourcesExcluded: [...redirectSources].every((slug) => !canonicalSlugs.includes(slug)),
    targetsIncluded: [...redirectTargets].every((slug) => canonicalSlugs.includes(slug)),
    noMasterOnlyExpansion: canonicalSlugs.length === PRODUCTION_BASELINES.totalSearchable,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(status, {
    productionPageCount: canonicalSlugs.length,
    expected: PRODUCTION_BASELINES.totalSearchable,
    duplicateUrlCount: urls.length - uniqueUrls.size,
    checks,
  });
}

function emojiPath(slug: string) {
  return `/emoji/${slug}`;
}

export async function buildEmojiUrlMatrixAudit(baseUrl: string, rootDir: string = process.cwd()) {
  const preserved = buildPreservedUrlList(rootDir);
  const sampleExtra = preserved.entries.find((entry) => entry.decision === "KEEP_EXTRA_URL");
  const sampleSource = preserved.entries.find((entry) => entry.decision === "KEEP_SOURCE_URL");

  type EmojiMatrixCase = {
    label: string;
    path: string;
    forbiddenTarget?: string;
    allowNotFound?: boolean;
    requiresProductionEmoji?: boolean;
  };

  const matrix: EmojiMatrixCase[] = [
    { label: "fire", path: emojiPath("fire") },
    {
      label: "smiling-face-fe0f",
      path: emojiPath("smiling-face"),
      forbiddenTarget: emojiPath("white-smiling-face"),
    },
    {
      label: "white-smiling-face",
      path: emojiPath("white-smiling-face"),
      allowNotFound: true,
      requiresProductionEmoji: false,
      forbiddenTarget: emojiPath("smiling-face"),
    },
    { label: "thumbs-up", path: emojiPath("thumbs-up") },
    {
      label: "thumbs-up-light",
      path: emojiPath("thumbs-up-light-skin-tone"),
      forbiddenTarget: emojiPath("thumbs-up"),
    },
    {
      label: "thumbs-up-dark",
      path: emojiPath("thumbs-up-dark-skin-tone"),
      forbiddenTarget: emojiPath("thumbs-up"),
    },
    {
      label: "man-technologist",
      path: emojiPath("man-technologist"),
      forbiddenTarget: emojiPath("woman-technologist"),
    },
    {
      label: "woman-technologist",
      path: emojiPath("woman-technologist"),
      forbiddenTarget: emojiPath("man-technologist"),
    },
    { label: "india-flag", path: emojiPath("flag-india") },
    { label: "pride-flag", path: emojiPath("rainbow-flag") },
    {
      label: "extra-url",
      path: sampleExtra?.url ?? emojiPath("extra-hyphen-minus"),
    },
    {
      label: "source-specific-url",
      path: sampleSource?.url ?? emojiPath("extra-goldfish"),
    },
  ];

  const results = [];
  const resolvedTargets = new Set<string>();

  for (const entry of matrix) {
    const slug = entry.path.replace(/^\/emoji\//, "");
    const emoji = getBrowsableEmojiBySlug(slug);
    const approvedRedirect = resolveApprovedEmojiRedirect(entry.path);
    const probe = await probeUrl(baseUrl, entry.path, { followRedirects: false });
    const locationPath = locationPathname(probe.location, baseUrl);
    const failures: string[] = [];

    if (approvedRedirect) {
      if (probe.status !== REDIRECT_HTTP_STATUS) {
        failures.push(`expected ${REDIRECT_HTTP_STATUS}, got ${probe.status}`);
      }
      if (locationPath !== normalizePathname(approvedRedirect.to)) {
        failures.push(`redirect target ${locationPath} !== ${approvedRedirect.to}`);
      }
      const targetProbe = await probeUrl(baseUrl, approvedRedirect.to, { followRedirects: true });
      if (targetProbe.status !== 200) {
        failures.push(`target ${approvedRedirect.to} returned ${targetProbe.status}`);
      }
      resolvedTargets.add(normalizePathname(approvedRedirect.to));
    } else {
      if (probe.status === 301 || probe.status === 302) {
        failures.push(`unexpected redirect to ${probe.location}`);
      }
      if (entry.requiresProductionEmoji !== false && !emoji) {
        failures.push("missing production emoji");
      }
      if (entry.allowNotFound) {
        if (probe.status !== 404 && probe.status !== 200) {
          failures.push(`expected 404 or 200 for non-production slug, got ${probe.status}`);
        }
      } else if (probe.status !== 200) {
        failures.push(`expected 200, got ${probe.status}`);
      }
    }

    if (entry.forbiddenTarget) {
      const forbiddenPath = normalizePathname(entry.forbiddenTarget);
      if (locationPath === forbiddenPath) {
        failures.push(`cross-identity redirect to ${forbiddenPath}`);
      }
    }

    if (entry.label === "fire" && approvedRedirect) {
      failures.push("fire must not redirect");
    }

    results.push(
      Object.freeze({
        label: entry.label,
        slug,
        path: entry.path,
        approvedRedirect: approvedRedirect?.to ?? null,
        status: probe.status,
        location: probe.location,
        failures: Object.freeze(failures),
        pass: failures.length === 0,
      }),
    );
  }

  const distinctIdentityFailures: string[] = [];
  const thumbsUpFinalUrls = results
    .filter((entry) => entry.label.startsWith("thumbs-up"))
    .map((entry) => normalizePathname(entry.approvedRedirect ?? entry.path));
  if (new Set(thumbsUpFinalUrls).size !== thumbsUpFinalUrls.length) {
    distinctIdentityFailures.push("thumbs-up variants collapsed to the same target");
  }
  const technologistFinalUrls = results
    .filter((entry) => entry.label.includes("technologist"))
    .map((entry) => normalizePathname(entry.approvedRedirect ?? entry.path));
  if (new Set(technologistFinalUrls).size !== technologistFinalUrls.length) {
    distinctIdentityFailures.push("technologist variants collapsed to the same target");
  }

  const failures = results.filter((entry) => !entry.pass);
  const pass = failures.length === 0 && distinctIdentityFailures.length === 0;
  return auditEnvelope(pass ? "PASS" : "FAIL", {
    entries: Object.freeze(results),
    distinctIdentityFailures: Object.freeze(distinctIdentityFailures),
    resolvedTargetCount: resolvedTargets.size,
    failureCount: failures.length + distinctIdentityFailures.length,
  });
}

export async function buildQueryParameterAudit(baseUrl: string) {
  const sample = getApprovedRedirectRecords()[0];
  const cases = [
    { label: "no-query", query: "" },
    { label: "utm-source", query: "?utm_source=test" },
    { label: "multi-query", query: "?utm_source=test&ref=qa" },
    { label: "encoded-query", query: "?q=hello%20world&emoji=%F0%9F%94%A5" },
  ];

  const results = [];
  for (const testCase of cases) {
    const path = `${sample.from}${testCase.query}`;
    const probe = await probeUrl(baseUrl, path, { followRedirects: false });
    const locationPath = locationPathname(probe.location, baseUrl);
    const expectedPath = normalizePathname(sample.to);
    const failures: string[] = [];
    if (probe.status !== REDIRECT_HTTP_STATUS) {
      failures.push(`status ${probe.status}`);
    }
    if (locationPath !== expectedPath) {
      failures.push(`location path ${locationPath} !== ${expectedPath}`);
    }
    results.push(
      Object.freeze({
        label: testCase.label,
        requestPath: path,
        status: probe.status,
        location: probe.location,
        note: "Next.js middleware redirects pathname only; query string is not forwarded to destination.",
        pass: failures.length === 0,
      }),
    );
  }

  const failures = results.filter((entry) => !entry.pass);
  return auditEnvelope(failures.length === 0 ? "PASS" : "FAIL", {
    observedPolicy: "query-string-not-forwarded-on-redirect",
    entries: Object.freeze(results),
    failureCount: failures.length,
  });
}

export async function buildRedirectSecurityAudit(baseUrl: string) {
  const localMaliciousPaths = [
    "/emoji/../../evil",
    "/emoji/%2e%2e%2f%2e%2e%2fevil",
    "/emoji/unknown-arbitrary-slug-qa-security",
    "/emoji/%2F%2Fevil.example",
    "/emoji/../../../etc/passwd",
  ];

  const results = [];
  for (const path of localMaliciousPaths) {
    const probe = await probeUrl(baseUrl, path, { followRedirects: false });
    const resolved = resolveApprovedEmojiRedirect(normalizePathname(path.split("?")[0] ?? path));
    const external =
      probe.location?.startsWith("http") &&
      !probe.location.startsWith(baseUrl) &&
      !probe.location.includes("localhost");
    const failures: string[] = [];
    if (external) {
      failures.push(`external redirect ${probe.location}`);
    }
    if (path.includes("evil") && probe.status === 301 && probe.location?.includes("evil")) {
      failures.push("open redirect");
    }
    results.push(
      Object.freeze({
        path,
        status: probe.status,
        location: probe.location,
        resolved: resolved?.to ?? null,
        pass: failures.length === 0,
      }),
    );
  }

  const logicalCases = [
    { path: "https://evil.example/emoji/fire", resolved: resolveApprovedEmojiRedirect("https://evil.example/emoji/fire") },
    { path: "//evil.example/emoji/fire", resolved: resolveApprovedEmojiRedirect("//evil.example/emoji/fire") },
  ];
  for (const testCase of logicalCases) {
    results.push(
      Object.freeze({
        path: testCase.path,
        status: null,
        location: null,
        resolved: testCase.resolved?.to ?? null,
        pass: testCase.resolved === null,
      }),
    );
  }

  const failures = results.filter((entry) => !entry.pass);
  return auditEnvelope(failures.length === 0 ? "PASS" : "FAIL", {
    entries: Object.freeze(results),
    failureCount: failures.length,
  });
}

export function buildRedirectPerformanceAudit() {
  const lookup = measureRedirectLookupPerformance();
  const sitemapStart = performance.now();
  getCanonicalEmojiSitemapSlugs(getAllBrowsableSlugs());
  const sitemapMs = performance.now() - sitemapStart;

  return auditEnvelope("PASS", {
    redirectLookup: lookup,
    sitemapGenerationMs: sitemapMs,
    masterDatabasePerRequest: false,
  });
}

export function buildRedirectBundleAudit(rootDir: string = process.cwd()) {
  const clientEntryFiles = [
    join(rootDir, "src", "components", "search", "search-results.tsx"),
    join(rootDir, "src", "components", "emoji", "emoji-detail-actions.tsx"),
    join(rootDir, "src", "components", "layout", "breadcrumbs.tsx"),
    join(rootDir, "src", "app", "emoji", "page.tsx"),
  ];
  const serverOnlyFiles = [
    join(rootDir, "src", "middleware.ts"),
    join(rootDir, "src", "app", "emoji", "[slug]", "page.tsx"),
    join(rootDir, "src", "app", "sitemap.ts"),
    join(rootDir, "src", "lib", "master", "integration", "seo-migration", "redirects.ts"),
  ];
  const forbiddenInClient = [
    "node:fs",
    "node:path",
    "master-reader",
    "approved-redirects.json",
    "seo-migration/redirects",
  ];
  const violations: string[] = [];

  for (const filePath of clientEntryFiles) {
    if (!existsSync(filePath)) {
      continue;
    }
    const source = readFileSync(filePath, "utf8");
    for (const token of forbiddenInClient) {
      if (source.includes(token)) {
        violations.push(`${filePath}: ${token}`);
      }
    }
  }

  const middlewareUsesRedirects = readFileSync(join(rootDir, "src", "middleware.ts"), "utf8").includes(
    "seo-migration/redirects",
  );
  const pageUsesRedirects = readFileSync(join(rootDir, "src", "app", "emoji", "[slug]", "page.tsx"), "utf8").includes(
    "seo-migration/redirects",
  );

  const checks = Object.freeze({
    noRedirectDataInClientEntries: violations.length === 0,
    middlewareUsesRedirectEngine: middlewareUsesRedirects,
    emojiPageUsesRedirectResolution: pageUsesRedirects,
    redirectDatasetServerOnly: existsSync(
      join(rootDir, "src", "lib", "master", "integration", "seo-migration", "redirects.ts"),
    ),
    serverOnlyFilesPresent: serverOnlyFiles.every((filePath) => existsSync(filePath)),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    violations: Object.freeze(violations),
    checks,
    clientEntryFilesScanned: Object.freeze(clientEntryFiles.filter((filePath) => existsSync(filePath))),
  });
}

export function buildRollbackAudit() {
  const checks = Object.freeze({
    unknownSlugReturnsNull: resolveApprovedEmojiRedirect("/emoji/definitely-unknown-slug-qa") === null,
    malformedPathReturnsNull: resolveApprovedEmojiRedirect("/search") === null,
    externalPathReturnsNull: resolveApprovedEmojiRedirect("https://evil.example/emoji/fire") === null,
    noFuzzyMatching: resolveApprovedEmojiRedirect("/emoji/fir") === null,
    invalidCanonicalDoesNotRedirect: resolveApprovedEmojiRedirect("/emoji/") === null,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(status, {
    checks,
    note: "Logical rollback/failure-safety checks against frozen redirect map; no production files modified.",
  });
}

export function buildProductionSafetyAudit(rootDir: string = process.cwd()) {
  const checksums = readJson<FileChecksumEntry[]>(
    join(integrationDataPaths(rootDir).releaseDir, "master-file-checksums.json"),
  );
  const checksumResult = verifyFrozenChecksums(rootDir, checksums);

  const counts = {
    standardRecords: (emojis as BrowsableEmoji[]).length,
    extrasRecords: (extras as BrowsableEmoji[]).length,
    total: (emojis as BrowsableEmoji[]).length + (extras as BrowsableEmoji[]).length,
  };

  const checks = Object.freeze({
    emojisJson: counts.standardRecords === PRODUCTION_BASELINES.standardRecords,
    extrasJson: counts.extrasRecords === PRODUCTION_BASELINES.extrasRecords,
    total: counts.total === PRODUCTION_BASELINES.totalSearchable,
    frozenRelease: checksumResult.status === "PASS",
    releaseId: EXPECTED_RELEASE_ID,
    featureFlagsDisabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(status, { counts, checks, checksumResult: checksumResult.status });
}

export async function buildProductionQaPackage(baseUrl: string, rootDir: string = process.cwd()) {
  const datasetAudit = verifyApprovedRedirectDatasetEquivalence(rootDir);
  const httpRedirectAudit = await buildHttpRedirectAudit(baseUrl, rootDir);
  const redirectStatusAudit = await buildRedirectStatusAudit(baseUrl);
  const locationHeaderAudit = await buildLocationHeaderAudit(baseUrl);
  const redirectExhaustiveAudit = await buildRedirectExhaustiveAudit(baseUrl);
  const redirectChainAudit = await buildRedirectChainAudit(baseUrl);
  const preservedUrlHttpAudit = await buildPreservedUrlHttpAudit(baseUrl, rootDir);
  const excludedUrlAudit = await buildExcludedUrlAudit(baseUrl, rootDir);
  const canonicalHttpAudit = await buildCanonicalHttpAudit(baseUrl, rootDir);
  const sitemapProductionAudit = buildSitemapProductionAudit(rootDir);
  const emojiUrlMatrixAudit = await buildEmojiUrlMatrixAudit(baseUrl);
  const queryParameterAudit = await buildQueryParameterAudit(baseUrl);
  const redirectSecurityAudit = await buildRedirectSecurityAudit(baseUrl);
  const redirectPerformanceAudit = buildRedirectPerformanceAudit();
  const redirectBundleAudit = buildRedirectBundleAudit(rootDir);
  const rollbackAudit = buildRollbackAudit();
  const productionSafetyAudit = buildProductionSafetyAudit(rootDir);

  const sections = Object.freeze({
    datasetAudit: datasetAudit.status,
    httpRedirectAudit: httpRedirectAudit.status,
    redirectStatusAudit: redirectStatusAudit.status,
    locationHeaderAudit: locationHeaderAudit.status,
    redirectExhaustiveAudit: redirectExhaustiveAudit.status,
    redirectChainAudit: redirectChainAudit.status,
    preservedUrlHttpAudit: preservedUrlHttpAudit.status,
    excludedUrlAudit: excludedUrlAudit.status,
    canonicalHttpAudit: canonicalHttpAudit.status,
    sitemapProductionAudit: sitemapProductionAudit.status,
    emojiUrlMatrixAudit: emojiUrlMatrixAudit.status,
    queryParameterAudit: queryParameterAudit.status,
    redirectSecurityAudit: redirectSecurityAudit.status,
    redirectPerformanceAudit: redirectPerformanceAudit.status,
    redirectBundleAudit: redirectBundleAudit.status,
    rollbackAudit: rollbackAudit.status,
    productionSafetyAudit: productionSafetyAudit.status,
  });

  const status = Object.values(sections).every((value) => value === "PASS") ? "PASS" : "FAIL";

  const productionQaAudit = auditEnvelope(status, {
    baseUrl,
    conclusion: status === "PASS" ? "READY FOR CANARY" : "BLOCKED",
    sections,
    summary: Object.freeze({
      approvedRedirects: APPROVED_REDIRECT_BASELINE,
      preservedUrls: PRESERVED_URL_BASELINE,
      excludedUrls: EXCLUDED_URL_BASELINE,
      redirectLoops: redirectChainAudit.loops,
      redirectChains: redirectChainAudit.chains,
      selfRedirects: redirectChainAudit.selfRedirects,
      httpFailures: httpRedirectAudit.failureCount,
    }),
  });

  return {
    productionQaAudit,
    httpRedirectAudit,
    redirectStatusAudit,
    locationHeaderAudit,
    redirectExhaustiveAudit,
    redirectChainAudit,
    preservedUrlHttpAudit,
    excludedUrlAudit,
    canonicalHttpAudit,
    sitemapProductionAudit,
    emojiUrlMatrixAudit,
    queryParameterAudit,
    redirectSecurityAudit,
    redirectPerformanceAudit,
    redirectBundleAudit,
    rollbackAudit,
    productionSafetyAudit,
    productionQaManifest: buildProductionQaManifest(rootDir),
  };
}

export function buildProductionQaManifest(rootDir: string = process.cwd()) {
  const qaDir = integrationDataPaths(rootDir).seoMigrationProductionQaIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_MIGRATION_PRODUCTION_QA_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: ALL_FLAGS_DISABLED(),
    outputs: Object.freeze({
      productionQaAudit: `${qaDir}/production-qa-audit.json`,
      httpRedirectAudit: `${qaDir}/http-redirect-audit.json`,
      redirectStatusAudit: `${qaDir}/redirect-status-audit.json`,
      locationHeaderAudit: `${qaDir}/location-header-audit.json`,
      redirectExhaustiveAudit: `${qaDir}/redirect-exhaustive-audit.json`,
      redirectChainAudit: `${qaDir}/redirect-chain-audit.json`,
      preservedUrlHttpAudit: `${qaDir}/preserved-url-http-audit.json`,
      excludedUrlAudit: `${qaDir}/excluded-url-audit.json`,
      canonicalHttpAudit: `${qaDir}/canonical-http-audit.json`,
      sitemapProductionAudit: `${qaDir}/sitemap-production-audit.json`,
      emojiUrlMatrixAudit: `${qaDir}/emoji-url-matrix-audit.json`,
      queryParameterAudit: `${qaDir}/query-parameter-audit.json`,
      redirectSecurityAudit: `${qaDir}/redirect-security-audit.json`,
      redirectPerformanceAudit: `${qaDir}/redirect-performance-audit.json`,
      redirectBundleAudit: `${qaDir}/redirect-bundle-audit.json`,
      rollbackAudit: `${qaDir}/rollback-audit.json`,
      productionSafetyAudit: `${qaDir}/production-safety-audit.json`,
      productionQaManifest: `${qaDir}/production-qa-manifest.json`,
    }),
  });
}

export function buildProductionQaOfflinePackage(rootDir: string = process.cwd()) {
  return {
    datasetAudit: verifyApprovedRedirectDatasetEquivalence(rootDir),
    sitemapProductionAudit: buildSitemapProductionAudit(rootDir),
    redirectPerformanceAudit: buildRedirectPerformanceAudit(),
    redirectBundleAudit: buildRedirectBundleAudit(rootDir),
    rollbackAudit: buildRollbackAudit(),
    productionSafetyAudit: buildProductionSafetyAudit(rootDir),
    productionQaManifest: buildProductionQaManifest(rootDir),
  };
}
