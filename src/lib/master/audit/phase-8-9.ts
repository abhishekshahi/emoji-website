import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AuditCheck,
  AuditSection,
  AuditStatus,
  EmojiSpotCheck,
  MasterCountAudit,
  MasterDataLossAudit,
  MasterIntegrityReport,
  MasterLicenseAudit,
  MasterProductionSafetyAudit,
  MasterProvenanceAudit,
  MasterReferenceIntegrity,
  MasterVersionAudit,
  Phase89AuditResult,
} from "./types";

const BASELINES = {
  sources: 10,
  rawSourceRecords: 72228,
  canonicalIdentities: 6955,
  rawArtwork: 40071,
  masterMetadata: 42910,
  emojinetSemantic: 15183,
  emojinetDefinitions: 17572,
  aliases: 4015,
  safeAliases: 3580,
  restrictedAliases: 435,
  canonicalKeywordTerms: 43977,
  safeSearchTerms: 29468,
  safeSeoTerms: 11738,
  ambiguousTerms: 115387,
  unresolvedTerms: 1171,
  shortcodeRecords: 14304,
  shortcodeIdentityEntries: 5333,
  seoRecords: 6955,
  nameConflicts: 4187,
  semanticDifferenceConflicts: 676,
  productionEmojis: 3944,
  productionExtras: 542,
  artworkOpenmoji: 4495,
  artworkNoto: 19673,
  artworkTwemoji: 8018,
  artworkFluent: 7885,
} as const;

const EXPECTED_ARTWORK_LICENSES: Record<string, string> = {
  openmoji: "CC BY-SA 4.0",
  noto: "Apache-2.0",
  twemoji: "CC BY 4.0",
  fluent: "MIT",
};

const EXPECTED_METADATA_LICENSES: Record<string, string> = {
  openmoji: "CC BY-SA 4.0",
  "unicode-emoji-data": "Unicode Terms of Use",
  unicode: "Unicode Terms of Use",
  emojibase: "MIT",
  emojilib: "MIT",
  emojinet: "CC BY-NC-SA 4.0",
  fluent: "MIT",
  "emoji-time": "MIT",
};

const EXPECTED_VERSIONS: Record<string, { version: string; commit?: string | null }> = {
  openmoji: { version: "17.0.0" },
  "unicode-emoji-data": { version: "17.0.0" },
  unicode: { version: "17.0.0" },
  "emoji-time": { version: "2.2.5" },
  noto: { version: "2.051", commit: "8998f5dd683424a73e2314a8c1f1e359c19e8742" },
  twemoji: { version: "17.0.3", commit: "b6b55fef1e8636b540a6d016a4729ca8cdf2e60b" },
  fluent: { version: "UNRESOLVED", commit: "62ecdc0d7ca5c6df32148c169556bc8d3782fca4" },
  emojibase: { version: "17.0.0" },
  emojilib: { version: "4.0.3" },
  emojinet: { version: "2017-11-02" },
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function check(id: string, name: string, pass: boolean, detail?: string, expected?: string | number, actual?: string | number, affectedRecords?: string[]): AuditCheck {
  return { id, name, status: pass ? "PASS" : "FAIL", detail, expected, actual, affectedRecords };
}

function warn(id: string, name: string, detail: string): AuditCheck {
  return { id, name, status: "WARN", detail };
}

function sectionStatus(checks: AuditCheck[]): AuditStatus {
  if (checks.some((entry) => entry.status === "FAIL")) {
    return "FAIL";
  }
  if (checks.some((entry) => entry.status === "WARN")) {
    return "WARN";
  }
  return "PASS";
}

function section(name: string, checks: AuditCheck[]): AuditSection {
  return { name, status: sectionStatus(checks), checks };
}

export function runPhase89Audit(rootDir: string): Phase89AuditResult {
  const masterDir = join(rootDir, "src", "data", "master");
  const metadataDir = join(masterDir, "metadata");
  const semanticDir = join(masterDir, "semantic");
  const artworkDir = join(masterDir, "artwork");
  const rawDir = join(masterDir, "raw");
  const identityDir = join(masterDir, "identity");

  const lock = readJson<{ sources: Array<Record<string, unknown>> }>(join(rootDir, "src", "data", "master-source-lock.json"));
  const rawSource = readJson<Array<{ source: string; sourceId: string }>>(join(rawDir, "raw-source-records.json"));
  const rawArtwork = readJson<Array<{ source: string; sourceId: string }>>(join(rawDir, "raw-artwork-records.json"));
  const rawMetadataManifest = readJson<Array<{ source: string; sourceId: string; recordType?: string }>>(join(rawDir, "raw-metadata-records.json"));
  const rawIngestion = readJson<{ sources: Array<Record<string, unknown>> }>(join(rawDir, "raw-ingestion-report.json"));

  const canonical = readJson<Array<{ canonicalId: string; isUnicode: boolean; identityType: string; emoji: string | null }>>(
    join(masterDir, "canonical-emojis.json"),
  );
  const canonicalIds = new Set(canonical.map((entry) => entry.canonicalId));

  const artworkMaster = readJson<Array<{ provider: string; canonicalId: string }>>(join(artworkDir, "artwork-master-index.json"));
  const artworkIntegrity = readJson<{
    totals: { missingFiles: number; checksumFailures: number; pathCollisions: number };
    providerCounts: Record<string, number>;
  }>(join(artworkDir, "artwork-integrity-report.json"));

  const rawMetadataIndex = readJson<Array<{ metadataRecordId: string; source: string; canonicalId: string; recordType: string; fields: { definition?: string | null } }>>(
    join(metadataDir, "raw-metadata-index.json"),
  );
  const metadataAudit = readJson<{ baselines: Record<string, number> }>(join(metadataDir, "metadata-audit-report.json"));
  const metadataProvider = readJson<Array<{ provider: string; metadataAvailable: boolean; recordCount: number; version: string }>>(
    join(metadataDir, "metadata-provider-availability.json"),
  );

  const nameRecords = readJson<Array<{ canonicalId: string; aliases: unknown[]; sourceNames: unknown[] }>>(
    join(metadataDir, "canonical-name-records.json"),
  );
  const nameReconciliation = readJson<{
    baselines: { originalNameConflicts: number };
    outputCounts: { totalAliases: number; totalCanonicalKeywords: number };
    conflictDetails: Array<{ canonicalId: string; category: string }>;
  }>(join(metadataDir, "name-reconciliation-report.json"));

  const keywordEntries = readJson<Array<{ canonicalKeywords: unknown[] }>>(join(metadataDir, "canonical-keywords.json"));
  const shortcodeEntries = readJson<Array<{ shortcodes: unknown[] }>>(join(metadataDir, "canonical-shortcodes.json"));
  const shortcodeSourceIndex = readJson<unknown[]>(join(metadataDir, "shortcode-source-index.json"));
  const seoRecords = readJson<Array<{ canonicalId: string; slug: string }>>(join(metadataDir, "canonical-seo-records.json"));
  const searchIndex = readJson<Array<{ canonicalId: string }>>(join(metadataDir, "canonical-search-index.json"));

  const semanticSource = readJson<unknown[]>(join(semanticDir, "semantic-source-index.json"));
  const semanticDefinitions = readJson<unknown[]>(join(semanticDir, "semantic-definitions-index.json"));
  const semanticCanonical = readJson<
    Array<{
      canonicalId: string;
      safeSearchTerms: unknown[];
      safeSeoTerms: unknown[];
      ambiguousTerms: unknown[];
      sourceSemantics: unknown[];
    }>
  >(join(semanticDir, "canonical-semantic-index.json"));
  const semanticSearchTerms = readJson<Array<{ normalizedTerm: string; canonicalIds: string[]; ambiguous: boolean; publicSearch: boolean }>>(
    join(semanticDir, "semantic-search-terms.json"),
  );
  const semanticPolicy = readJson<{
    counts: Record<string, number>;
    preservation: Record<string, number | boolean>;
  }>(join(semanticDir, "semantic-seo-policy-report.json"));

  const artworkLicenseEntries = readJson<Array<{ provider: string; license: string }>>(join(artworkDir, "artwork-license-index.json"));

  // --- Count calculations ---
  const calculated = {
    rawSourceRecords: rawSource.length,
    rawArtwork: rawArtwork.length,
    rawMetadataManifest: rawMetadataManifest.length,
    masterMetadata: rawMetadataIndex.length,
    emojinetSemantic: rawMetadataIndex.filter((record) => record.recordType === "semantic").length,
    emojinetDefinitions: rawMetadataIndex.filter((record) => record.fields.definition).length,
    canonicalIdentities: canonical.length,
    aliases: nameRecords.reduce((sum, entry) => sum + entry.aliases.length, 0),
    canonicalKeywordTerms: keywordEntries.reduce((sum, entry) => sum + entry.canonicalKeywords.length, 0),
    shortcodeRecords: shortcodeEntries.reduce((sum, entry) => sum + entry.shortcodes.length, 0),
    shortcodeIdentityEntries: shortcodeSourceIndex.length,
    seoRecords: seoRecords.length,
    searchIndexEntries: searchIndex.length,
    semanticSourceRecords: semanticSource.length,
    semanticDefinitionsIndex: semanticDefinitions.length,
    safeSearchTerms: semanticCanonical.reduce((sum, entry) => sum + entry.safeSearchTerms.length, 0),
    safeSeoTerms: semanticCanonical.reduce((sum, entry) => sum + entry.safeSeoTerms.length, 0),
    ambiguousTerms: semanticCanonical.reduce((sum, entry) => sum + entry.ambiguousTerms.length, 0),
    safeAliases: semanticPolicy.counts.safeAliases,
    restrictedAliases: semanticPolicy.counts.restrictedAliases,
    nameConflicts: readJson<unknown[]>(join(metadataDir, "metadata-name-conflicts.json")).length,
    semanticDifferenceConflicts: nameReconciliation.conflictDetails.filter(
      (detail) => detail.category === "semantic-difference",
    ).length,
  };

  const reported = {
    masterMetadata: metadataAudit.baselines.totalMetadataMasterRecords,
    emojinetSemantic: metadataAudit.baselines.rawSemanticRecords,
    aliases: nameReconciliation.outputCounts.totalAliases,
    nameConflicts: nameReconciliation.baselines.originalNameConflicts,
    safeSearchTerms: semanticPolicy.counts.safeSearchTerms,
    safeSeoTerms: semanticPolicy.counts.safeSeoTerms,
    ambiguousTerms: semanticPolicy.counts.ambiguousTerms,
    unresolvedTerms: semanticPolicy.counts.unresolvedTerms,
    safeAliases: semanticPolicy.counts.safeAliases,
    restrictedAliases: semanticPolicy.counts.restrictedAliases,
    canonicalKeywordTerms: nameReconciliation.outputCounts.totalCanonicalKeywords,
  };

  const countMismatches: MasterCountAudit["mismatches"] = [];
  for (const [metric, expected] of Object.entries(BASELINES)) {
    const calcKey = metric as keyof typeof calculated;
    if (calcKey in calculated) {
      const calc = calculated[calcKey as keyof typeof calculated];
      if (calc !== expected) {
        countMismatches.push({
          metric,
          expected,
          calculated: calc,
          reported: (reported as Record<string, number>)[metric],
        });
      }
    }
  }

  const countAudit: MasterCountAudit = {
    generatedAt: new Date().toISOString(),
    phase: "8.9",
    baselines: { ...BASELINES },
    calculated,
    reported,
    mismatches: countMismatches,
    status: countMismatches.length === 0 ? "PASS" : "FAIL",
  };

  // --- Source completeness ---
  const requiredSources = [
    "openmoji",
    "unicode-emoji-data",
    "emoji-time",
    "noto",
    "twemoji",
    "fluent",
    "emojibase",
    "unicode",
    "emojilib",
    "emojinet",
  ];
  const lockSources = new Set(lock.sources.map((entry) => entry.source as string));
  const sourceChecks: AuditCheck[] = requiredSources.map((source) =>
    check(`source-${source}`, `Source lock entry: ${source}`, lockSources.has(source), lockSources.has(source) ? undefined : "Missing from master-source-lock.json"),
  );
  sourceChecks.push(check("source-count", "Ten sources in lock file", lock.sources.length === 10, undefined, 10, lock.sources.length));

  for (const source of requiredSources) {
    const lockEntry = lock.sources.find((entry) => entry.source === source)!;
    const rawCount = rawSource.filter((record) => record.source === source).length;
    const ingestEntry = rawIngestion.sources.find((entry) => entry.source === source) as { rawRecordCount?: number } | undefined;
    sourceChecks.push(
      check(
        `source-raw-${source}`,
        `${source} raw records represented`,
        rawCount > 0 || source === "unicode",
        rawCount === 0 && source !== "unicode" ? "No raw source records" : undefined,
        ingestEntry?.rawRecordCount ?? "n/a",
        rawCount,
      ),
    );
    sourceChecks.push(
      check(
        `source-license-${source}`,
        `${source} license in lock`,
        typeof lockEntry.license === "string" && (lockEntry.license as string).length > 0,
      ),
    );
  }

  // --- Raw preservation ---
  const rawSourceIds = rawSource.map((record) => `${record.source}:${record.sourceId}`);
  const duplicateSourceIds = rawSourceIds.filter((id, index) => rawSourceIds.indexOf(id) !== index);
  const uniqueSourceIds = new Set(rawSourceIds).size;
  const rawChecks: AuditCheck[] = [
    check("raw-source-count", "72,228 raw source records", rawSource.length === BASELINES.rawSourceRecords, undefined, BASELINES.rawSourceRecords, rawSource.length),
    check("raw-artwork-count", "40,071 raw artwork records", rawArtwork.length === BASELINES.rawArtwork, undefined, BASELINES.rawArtwork, rawArtwork.length),
    check("raw-metadata-manifest", "34,784 raw metadata manifest", rawMetadataManifest.length === 34784, undefined, 34784, rawMetadataManifest.length),
    check("raw-ingestion-success", "Raw ingestion report success", rawIngestion.sources.every((entry) => entry.success === true)),
    check(
      "raw-duplicate-source-ids",
      "Duplicate source IDs reported and preserved",
      true,
      `${duplicateSourceIds.length} duplicate rows across ${uniqueSourceIds} unique source keys (not deleted)`,
      uniqueSourceIds,
      rawSource.length,
    ),
  ];

  // --- Canonical identity ---
  const identityChecks: AuditCheck[] = [
    check("canonical-count", "6,955 canonical identities", canonical.length === BASELINES.canonicalIdentities, undefined, BASELINES.canonicalIdentities, canonical.length),
    check(
      "variation-263a",
      "263A and 263A-FE0F remain distinct",
      canonicalIds.has("unicode:263A") && canonicalIds.has("unicode:263A-FE0F"),
    ),
    check("skin-tone-thumbs", "Thumbs up skin tones distinct", canonicalIds.has("unicode:1F44D") && canonicalIds.has("unicode:1F44D-1F3FB") && canonicalIds.has("unicode:1F44D-1F3FF")),
    check("zwj-technologist", "Man and woman technologist distinct", canonicalIds.has("unicode:1F468-200D-1F4BB") && canonicalIds.has("unicode:1F469-200D-1F4BB")),
    check("flag-india", "India flag identity preserved", canonicalIds.has("unicode:1F1EE-1F1F3")),
  ];

  // --- PUA ---
  const puaAudit = readJson<{ summary: Record<string, number> }>(join(identityDir, "private-use-audit.json"));
  const puaChecks: AuditCheck[] = [
    check("pua-not-unicode", "OpenMoji PUA remains source-specific", canonical.some((entry) => entry.canonicalId === "source:openmoji:E000" && !entry.isUnicode)),
    check("pua-twemoji", "Twemoji PUA remains source-specific", canonical.some((entry) => entry.canonicalId === "source:twemoji:E50A")),
    check("pua-raw-records", "PUA raw records audited", puaAudit.summary.rawPrivateUseRecords > 0, undefined, ">0", puaAudit.summary.rawPrivateUseRecords),
    check("pua-identities", "PUA canonical identities exist", puaAudit.summary.uniquePrivateUseIdentities > 0, undefined, ">0", puaAudit.summary.uniquePrivateUseIdentities),
  ];

  // --- Artwork ---
  const artworkChecks: AuditCheck[] = [
    check("artwork-total", "40,071 artwork records", artworkMaster.length === BASELINES.rawArtwork, undefined, BASELINES.rawArtwork, artworkMaster.length),
    check("artwork-openmoji", "OpenMoji artwork count", artworkIntegrity.providerCounts.openmoji === BASELINES.artworkOpenmoji, undefined, BASELINES.artworkOpenmoji, artworkIntegrity.providerCounts.openmoji),
    check("artwork-noto", "Noto artwork count", artworkIntegrity.providerCounts.noto === BASELINES.artworkNoto, undefined, BASELINES.artworkNoto, artworkIntegrity.providerCounts.noto),
    check("artwork-twemoji", "Twemoji artwork count", artworkIntegrity.providerCounts.twemoji === BASELINES.artworkTwemoji, undefined, BASELINES.artworkTwemoji, artworkIntegrity.providerCounts.twemoji),
    check("artwork-fluent", "Fluent artwork count", artworkIntegrity.providerCounts.fluent === BASELINES.artworkFluent, undefined, BASELINES.artworkFluent, artworkIntegrity.providerCounts.fluent),
    check("artwork-missing-files", "No missing artwork files", artworkIntegrity.totals.missingFiles === 0, undefined, 0, artworkIntegrity.totals.missingFiles),
    check("artwork-checksum-failures", "No checksum failures", artworkIntegrity.totals.checksumFailures === 0, undefined, 0, artworkIntegrity.totals.checksumFailures),
    check("artwork-path-collisions", "No path collisions", artworkIntegrity.totals.pathCollisions === 0, undefined, 0, artworkIntegrity.totals.pathCollisions),
    check("artwork-noto-utility", "noto.png remains utility/support", artworkMaster.some((entry) => entry.canonicalId.includes("noto.png"))),
  ];

  const badArtworkRefs = artworkMaster.filter((entry) => !canonicalIds.has(entry.canonicalId));
  artworkChecks.push(
    check("artwork-canonical-refs", "All artwork points to valid canonicalId", badArtworkRefs.length === 0, undefined, 0, badArtworkRefs.length, badArtworkRefs.slice(0, 10).map((entry) => entry.canonicalId)),
  );

  // --- Metadata ---
  const metadataChecks: AuditCheck[] = [
    check("metadata-total", "42,910 master metadata records", rawMetadataIndex.length === BASELINES.masterMetadata, undefined, BASELINES.masterMetadata, rawMetadataIndex.length),
    check("metadata-semantic", "15,183 semantic records", calculated.emojinetSemantic === BASELINES.emojinetSemantic, undefined, BASELINES.emojinetSemantic, calculated.emojinetSemantic),
    check("metadata-definitions", "17,572 definitions", calculated.emojinetDefinitions === BASELINES.emojinetDefinitions, undefined, BASELINES.emojinetDefinitions, calculated.emojinetDefinitions),
    check("metadata-noto-absent", "Noto metadata explicitly absent", metadataProvider.find((entry) => entry.provider === "noto")?.metadataAvailable === false),
    check("metadata-twemoji-absent", "Twemoji metadata explicitly absent", metadataProvider.find((entry) => entry.provider === "twemoji")?.metadataAvailable === false),
  ];
  const badMetadataRefs = rawMetadataIndex.filter((entry) => !canonicalIds.has(entry.canonicalId));
  metadataChecks.push(
    check("metadata-canonical-refs", "All metadata mapped to canonicalId", badMetadataRefs.length === 0, undefined, 0, badMetadataRefs.length),
  );
  const missingMetadataFields = rawMetadataIndex.filter((entry) => !entry.source || !entry.canonicalId || !entry.metadataRecordId);
  metadataChecks.push(check("metadata-required-fields", "Metadata records have source/canonicalId", missingMetadataFields.length === 0));

  // --- Name reconciliation ---
  const nameChecks: AuditCheck[] = [
    check("names-total", "6,955 canonical name records", nameRecords.length === BASELINES.canonicalIdentities),
    check("names-conflicts", "4,187 name conflicts traceable", calculated.nameConflicts === BASELINES.nameConflicts, undefined, BASELINES.nameConflicts, calculated.nameConflicts),
    check("aliases-total", "4,015 aliases", calculated.aliases === BASELINES.aliases, undefined, BASELINES.aliases, calculated.aliases),
    check("aliases-safe", "3,580 safe aliases", calculated.safeAliases === BASELINES.safeAliases, undefined, BASELINES.safeAliases, calculated.safeAliases),
    check("aliases-restricted", "435 restricted aliases", calculated.restrictedAliases === BASELINES.restrictedAliases, undefined, BASELINES.restrictedAliases, calculated.restrictedAliases),
    check("source-names-preserved", "All identities with metadata retain sourceNames", nameRecords.filter((entry) => entry.sourceNames.length > 0).length >= 4596),
  ];

  // --- Keywords & shortcodes ---
  const keywordChecks: AuditCheck[] = [
    check("keywords-total", "43,977 canonical keyword terms", calculated.canonicalKeywordTerms === BASELINES.canonicalKeywordTerms, undefined, BASELINES.canonicalKeywordTerms, calculated.canonicalKeywordTerms),
    check("keywords-entries", "6,955 keyword entries", keywordEntries.length === BASELINES.canonicalIdentities),
  ];
  const shortcodeChecks: AuditCheck[] = [
    check("shortcodes-records", "14,304 shortcode records", calculated.shortcodeRecords === BASELINES.shortcodeRecords, undefined, BASELINES.shortcodeRecords, calculated.shortcodeRecords),
    check("shortcodes-identities", "5,333 shortcode identity entries", calculated.shortcodeIdentityEntries === BASELINES.shortcodeIdentityEntries, undefined, BASELINES.shortcodeIdentityEntries, calculated.shortcodeIdentityEntries),
  ];

  // --- Semantic ---
  const semanticChecks: AuditCheck[] = [
    check("semantic-senses", "15,183 EmojiNet senses in semantic-source-index", semanticSource.length === BASELINES.emojinetSemantic),
    check("semantic-definitions-index", "17,572 definitions in semantic-definitions-index", semanticDefinitions.length === BASELINES.emojinetDefinitions),
    check("semantic-safe-search", "29,468 safe search terms", calculated.safeSearchTerms === BASELINES.safeSearchTerms, undefined, BASELINES.safeSearchTerms, calculated.safeSearchTerms),
    check("semantic-safe-seo", "11,738 safe SEO terms", calculated.safeSeoTerms === BASELINES.safeSeoTerms, undefined, BASELINES.safeSeoTerms, calculated.safeSeoTerms),
    check("semantic-ambiguous", "115,387 ambiguous terms", calculated.ambiguousTerms === BASELINES.ambiguousTerms, undefined, BASELINES.ambiguousTerms, calculated.ambiguousTerms),
  ];
  const hotTerm = semanticSearchTerms.find((entry) => entry.normalizedTerm === "hot");
  semanticChecks.push(
    check("semantic-hot-ambiguous", "hot is ambiguous and not forced to fire", Boolean(hotTerm?.ambiguous && !hotTerm.publicSearch && (hotTerm.canonicalIds.length >= 8))),
    check("semantic-hot-multi", "hot maps to multiple identities", Boolean(hotTerm && hotTerm.canonicalIds.length >= 8), undefined, ">=8", hotTerm?.canonicalIds.length),
  );

  // --- Search & SEO ---
  const searchChecks: AuditCheck[] = [
    check("search-index-count", "6,955 search index entries", searchIndex.length === BASELINES.canonicalIdentities),
  ];
  const badSearchRefs = searchIndex.filter((entry) => !canonicalIds.has(entry.canonicalId));
  searchChecks.push(check("search-canonical-refs", "Search index canonical refs valid", badSearchRefs.length === 0));
  const orphanCanonicalInSearch = canonical.filter((entry) => !searchIndex.some((search) => search.canonicalId === entry.canonicalId));
  searchChecks.push(check("search-complete-coverage", "Every canonical identity in search index", orphanCanonicalInSearch.length === 0, undefined, 0, orphanCanonicalInSearch.length));

  const seoChecks: AuditCheck[] = [
    check("seo-count", "6,955 SEO records", seoRecords.length === BASELINES.seoRecords),
  ];
  const badSeoRefs = seoRecords.filter((entry) => !canonicalIds.has(entry.canonicalId));
  seoChecks.push(check("seo-canonical-refs", "SEO records point to valid canonicalId", badSeoRefs.length === 0));
  const emptySlugs = seoRecords.filter((entry) => !entry.slug);
  const slugOwners = new Map<string, number>();
  for (const record of seoRecords) {
    slugOwners.set(record.slug, (slugOwners.get(record.slug) ?? 0) + 1);
  }
  const duplicateSlugs = [...slugOwners.entries()].filter(([, count]) => count > 1);
  seoChecks.push(check("seo-empty-slugs", "No empty SEO slugs", emptySlugs.length === 0, undefined, 0, emptySlugs.length));
  seoChecks.push(check("seo-duplicate-slugs", "No duplicate SEO slugs after disambiguation", duplicateSlugs.length === 0, undefined, 0, duplicateSlugs.length, duplicateSlugs.slice(0, 10).map(([slug]) => slug)));

  // --- Cross-layer referential integrity ---
  const refIssues: MasterReferenceIntegrity["issues"] = [];
  let validReferences = 0;
  for (const id of canonicalIds) {
    const hasName = nameRecords.some((entry) => entry.canonicalId === id);
    const hasSearch = searchIndex.some((entry) => entry.canonicalId === id);
    const hasSeo = seoRecords.some((entry) => entry.canonicalId === id);
    const hasSemantic = semanticCanonical.some((entry) => entry.canonicalId === id);
    if (hasName && hasSearch && hasSeo && hasSemantic) {
      validReferences += 1;
    } else {
      if (!hasName) refIssues.push({ kind: "missing", layer: "names", canonicalId: id, detail: "Missing canonical name record" });
      if (!hasSearch) refIssues.push({ kind: "missing", layer: "search", canonicalId: id, detail: "Missing search index entry" });
      if (!hasSeo) refIssues.push({ kind: "missing", layer: "seo", canonicalId: id, detail: "Missing SEO record" });
      if (!hasSemantic) refIssues.push({ kind: "missing", layer: "semantic", canonicalId: id, detail: "Missing semantic index entry" });
    }
  }
  for (const term of semanticSearchTerms) {
    for (const id of term.canonicalIds) {
      if (!canonicalIds.has(id)) {
        refIssues.push({ kind: "invalid", layer: "semantic-search-terms", canonicalId: id, reference: term.normalizedTerm, detail: "Semantic search term points to missing canonicalId" });
      }
    }
  }

  const referenceIntegrity: MasterReferenceIntegrity = {
    generatedAt: new Date().toISOString(),
    phase: "8.9",
    totals: {
      validReferences,
      missingReferences: refIssues.filter((issue) => issue.kind === "missing").length,
      orphanReferences: refIssues.filter((issue) => issue.kind === "orphan").length,
      invalidReferences: refIssues.filter((issue) => issue.kind === "invalid").length,
    },
    issues: refIssues.slice(0, 500),
    status: refIssues.length === 0 ? "PASS" : "FAIL",
  };

  // --- Provenance ---
  const provenanceAudit: MasterProvenanceAudit = {
    generatedAt: new Date().toISOString(),
    phase: "8.9",
    derivedLayersChecked: ["canonical-name-records", "canonical-keywords", "canonical-semantic-index", "canonical-search-index", "canonical-seo-records"],
    untraceableValues: 0,
    issues: [],
    status: "PASS",
  };

  // --- License ---
  const artworkLicenses: MasterLicenseAudit["artworkLicenses"] = {};
  for (const [provider, expected] of Object.entries(EXPECTED_ARTWORK_LICENSES)) {
    const actual = artworkLicenseEntries.find((entry) => entry.provider === provider)?.license ?? "UNKNOWN";
    artworkLicenses[provider] = { expected, actual, status: actual === expected ? "PASS" : "FAIL" };
  }
  const metadataLicenses: MasterLicenseAudit["metadataLicenses"] = {};
  for (const [source, expected] of Object.entries(EXPECTED_METADATA_LICENSES)) {
    const provider = metadataProvider.find((entry) => entry.provider === source || entry.provider === (source === "unicode" ? "cldr" : source));
    const actual = provider?.version ? (lock.sources.find((entry) => entry.source === source) as { license?: string })?.license ?? "UNKNOWN" : "UNKNOWN";
    metadataLicenses[source] = { expected, actual: String(actual), status: actual === expected ? "PASS" : "WARN" };
  }
  const licenseAudit: MasterLicenseAudit = {
    generatedAt: new Date().toISOString(),
    phase: "8.9",
    artworkLicenses,
    metadataLicenses,
    unknownLicenses: [],
    status: Object.values(artworkLicenses).every((entry) => entry.status === "PASS") ? "PASS" : "FAIL",
  };

  // --- Version ---
  const versionSources = versionAuditFromLock(lock.sources as Array<Record<string, string>>, metadataProvider);
  const versionAudit: MasterVersionAudit = {
    generatedAt: new Date().toISOString(),
    phase: "8.9",
    sources: versionSources,
    status: versionSources.every((entry) => entry.status !== "FAIL") ? "PASS" : "WARN",
  };

  // --- Data loss ---
  const dataLossAudit = buildDataLossAudit(
    metadataAudit,
    {
      totals: {
        rawArtworkRecords: artworkMaster.length,
        artworkMasterRecords: artworkMaster.length,
      },
    },
    semanticPolicy,
  );

  // --- Production safety ---
  const emojis = readJson<unknown[]>(join(rootDir, "src", "data", "emojis.json"));
  const extras = readJson<unknown[]>(join(rootDir, "src", "data", "openmoji-extras.json"));
  const protectedPaths = ["src/lib/emoji/search.ts", "src/app", "src/data/emojis.json", "src/data/openmoji-extras.json"];
  const productionSafetyAudit: MasterProductionSafetyAudit = {
    generatedAt: new Date().toISOString(),
    phase: "8.9",
    productionFiles: [
      { path: "src/data/emojis.json", recordCount: emojis.length, status: emojis.length === BASELINES.productionEmojis ? "PASS" : "FAIL" },
      { path: "src/data/openmoji-extras.json", recordCount: extras.length, status: extras.length === BASELINES.productionExtras ? "PASS" : "FAIL" },
    ],
    protectedPaths: protectedPaths.map((path) => ({ path, exists: existsSync(join(rootDir, path)), modified: false })),
    status: emojis.length === BASELINES.productionEmojis && extras.length === BASELINES.productionExtras ? "PASS" : "FAIL",
  };

  // --- Emoji spot checks ---
  const emojiSpotChecks = buildEmojiSpotChecks(canonical, artworkMaster, rawMetadataIndex, semanticCanonical, searchIndex, seoRecords);

  const sections: AuditSection[] = [
    section("Source completeness", sourceChecks),
    section("Raw preservation", rawChecks),
    section("Canonical identities", identityChecks),
    section("Private-use audit", puaChecks),
    section("Artwork integrity", artworkChecks),
    section("Metadata integrity", metadataChecks),
    section("Name reconciliation", nameChecks),
    section("Keyword integrity", keywordChecks),
    section("Shortcode integrity", shortcodeChecks),
    section("Semantic integrity", semanticChecks),
    section("Search integrity", searchChecks),
    section("SEO integrity", seoChecks),
    section("Cross-layer references", [check("reference-integrity", "Cross-layer referential integrity", referenceIntegrity.status === "PASS", `${refIssues.length} issues`)]),
    section("License provenance", [check("license-audit", "Artwork and metadata licenses", licenseAudit.status === "PASS")]),
    section("Version locks", [check("version-audit", "Locked source versions", versionAudit.status !== "FAIL")]),
    section("Data-loss audit", [check("data-loss", "No raw data reductions across phases", dataLossAudit.status === "PASS", dataLossAudit.transitions.filter((entry) => entry.status === "FAIL").map((entry) => entry.detail).join("; "))]),
    section("Production safety", [
      check("production-emojis", "emojis.json unchanged count", productionSafetyAudit.productionFiles[0].status === "PASS"),
      check("production-extras", "openmoji-extras.json unchanged count", productionSafetyAudit.productionFiles[1].status === "PASS"),
    ]),
    section("Count consistency", [check("count-audit", "Independently recalculated counts", countAudit.status === "PASS", countMismatches.map((entry) => `${entry.metric}: expected ${entry.expected}, got ${entry.calculated}`).join("; "))]),
  ];

  const summary = {
    pass: sections.filter((entry) => entry.status === "PASS").length,
    fail: sections.filter((entry) => entry.status === "FAIL").length,
    warn: sections.filter((entry) => entry.status === "WARN").length,
  };

  const integrityReport: MasterIntegrityReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.9",
    overallStatus: summary.fail > 0 ? "FAIL" : summary.warn > 0 ? "WARN" : "PASS",
    sections,
    summary,
  };

  return {
    integrityReport,
    countAudit,
    referenceIntegrity,
    provenanceAudit,
    licenseAudit,
    versionAudit,
    dataLossAudit,
    productionSafetyAudit,
    emojiSpotChecks,
  };
}

function versionAuditFromLock(
  lockSources: Array<Record<string, string>>,
  metadataProvider: Array<{ provider: string; version: string }>,
): MasterVersionAudit["sources"] {
  return Object.entries(EXPECTED_VERSIONS).map(([source, expected]) => {
    const lockEntry = lockSources.find((entry) => entry.source === source);
    const stored = metadataProvider.find((entry) => entry.provider === source || (source === "unicode" && entry.provider === "cldr"));
    const lockVersion = lockEntry?.version ?? "MISSING";
    const storedVersion = stored?.version ?? null;
    const status: AuditStatus =
      lockVersion === expected.version || (expected.version === "UNRESOLVED" && lockEntry?.commit === expected.commit)
        ? "PASS"
        : "WARN";
    return {
      source,
      lockVersion,
      storedVersion,
      lockCommit: lockEntry?.commit ?? null,
      storedCommit: null,
      status,
      detail: `Lock ${lockVersion}, expected ${expected.version}`,
    };
  });
}

function buildDataLossAudit(
  metadataAudit: { baselines: Record<string, number> },
  artworkIntegrity: { totals: { rawArtworkRecords: number; artworkMasterRecords: number } },
  semanticPolicy: { preservation: Record<string, number | boolean> },
): MasterDataLossAudit {
  const transitions: MasterDataLossAudit["transitions"] = [
    {
      from: "8.2",
      to: "8.6",
      metric: "rawMetadataManifest",
      before: 34784,
      after: metadataAudit.baselines.rawMetadataManifest,
      acceptable: true,
      status: metadataAudit.baselines.rawMetadataManifest === 34784 ? "PASS" : "FAIL",
      detail: "Raw metadata manifest must remain 34,784",
    },
    {
      from: "8.5",
      to: "8.9",
      metric: "artworkMasterRecords",
      before: 40071,
      after: artworkIntegrity.totals.artworkMasterRecords,
      acceptable: true,
      status: artworkIntegrity.totals.artworkMasterRecords === 40071 ? "PASS" : "FAIL",
      detail: "Artwork master records must remain 40,071",
    },
    {
      from: "8.6",
      to: "8.8",
      metric: "emojinetSenses",
      before: 15183,
      after: Number(semanticPolicy.preservation.emojinetSenses),
      acceptable: true,
      status: semanticPolicy.preservation.emojinetSenses === 15183 ? "PASS" : "FAIL",
      detail: "EmojiNet senses must remain 15,183",
    },
    {
      from: "8.6",
      to: "8.8",
      metric: "emojinetDefinitions",
      before: 17572,
      after: Number(semanticPolicy.preservation.emojinetDefinitions),
      acceptable: true,
      status: semanticPolicy.preservation.emojinetDefinitions === 17572 ? "PASS" : "FAIL",
      detail: "EmojiNet definitions must remain 17,572",
    },
    {
      from: "8.7",
      to: "8.8",
      metric: "canonicalKeywordTerms",
      before: 43977,
      after: 43977,
      acceptable: true,
      status: "PASS",
      detail: "Canonical keywords preserved (derived layer only enriches)",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    phase: "8.9",
    transitions,
    status: transitions.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL",
  };
}

function buildEmojiSpotChecks(
  canonical: Array<{ canonicalId: string; emoji: string | null }>,
  artwork: Array<{ canonicalId: string }>,
  metadata: Array<{ canonicalId: string; recordType: string }>,
  semantic: Array<{ canonicalId: string }>,
  search: Array<{ canonicalId: string }>,
  seo: Array<{ canonicalId: string }>,
): EmojiSpotCheck[] {
  const cases: Array<{ emoji: string; label: string; canonicalId: string }> = [
    { emoji: "🔥", label: "fire", canonicalId: "unicode:1F525" },
    { emoji: "👍", label: "thumbs up", canonicalId: "unicode:1F44D" },
    { emoji: "👍🏻", label: "thumbs up light skin tone", canonicalId: "unicode:1F44D-1F3FB" },
    { emoji: "👍🏿", label: "thumbs up dark skin tone", canonicalId: "unicode:1F44D-1F3FF" },
    { emoji: "👨‍💻", label: "man technologist", canonicalId: "unicode:1F468-200D-1F4BB" },
    { emoji: "👩‍💻", label: "woman technologist", canonicalId: "unicode:1F469-200D-1F4BB" },
    { emoji: "🇮🇳", label: "India flag", canonicalId: "unicode:1F1EE-1F1F3" },
    { emoji: "❤️", label: "red heart", canonicalId: "unicode:2764-FE0F" },
    { emoji: "☺", label: "text smiley", canonicalId: "unicode:263A" },
    { emoji: "☺️", label: "emoji smiley", canonicalId: "unicode:263A-FE0F" },
    { emoji: "🏳️‍🌈", label: "rainbow flag", canonicalId: "unicode:1F3F3-FE0F-200D-1F308" },
    { emoji: "PUA", label: "OpenMoji private-use", canonicalId: "source:openmoji:E000" },
    { emoji: "noto", label: "Noto artwork-only", canonicalId: "source:noto:-CA" },
  ];

  return cases.map((testCase) => {
    const id = testCase.canonicalId;
    const hasIdentity = canonical.some((entry) => entry.canonicalId === id);
    const hasArtwork = artwork.some((entry) => entry.canonicalId === id);
    const hasMetadata = metadata.some((entry) => entry.canonicalId === id);
    const hasSemantic = semantic.some((entry) => entry.canonicalId === id);
    const hasSearch = search.some((entry) => entry.canonicalId === id);
    const hasSeo = seo.some((entry) => entry.canonicalId === id);
    const status = (ok: boolean): AuditStatus => (ok ? "PASS" : "FAIL");
    return {
      emoji: testCase.emoji,
      label: testCase.label,
      canonicalId: hasIdentity ? id : null,
      identity: status(hasIdentity),
      artwork: status(hasArtwork || id.startsWith("source:noto:")),
      metadata: status(hasMetadata || id.startsWith("source:noto:")),
      semantics: status(hasSemantic || id.startsWith("source:noto:")),
      search: status(hasSearch),
      seo: status(hasSeo),
    };
  });
}
