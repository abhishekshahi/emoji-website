import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifySearchIntent } from "@/lib/content/search-intent/classifier";
import { listPublishedCombinations } from "@/lib/content/combinations/registry";
import { listPublishedCollections } from "@/lib/content/collections/registry";
import { getAllFaqItems } from "@/lib/content/faq/global-faq";
import { ANALYTICS_MATURITY } from "@/lib/content/analytics/events";
import { computeKnowledgeCoverage } from "@/lib/content/knowledge/coverage";
import { getSearchQualityDatasetSize } from "@/lib/content/search-intent/quality-dataset";
import { isCombinationSearchQuery, searchCombinationsByIntent } from "@/lib/content/search-intent/combination-search";
import { buildZeroResultRecovery, isNonsenseQuery } from "@/lib/content/search-intent/zero-results";
import { getTrendingItems, TRENDING_LABEL } from "@/lib/content/analytics/trending";
import { buildContentGraph } from "@/lib/content/graph/links";
import { listUnicodeVersions } from "@/lib/content/unicode/registry";
import { listPlatforms } from "@/lib/content/platforms/registry";
import { findCanonicalIdByLocalizedKeyword } from "@/lib/content/localization/keywords";
import { getPublishedHreflangLanguages } from "@/lib/content/localization/published-pages";
import { parseDocumentLangFromPathname, buildSearchHref, resolveDocumentLang } from "@/lib/content/localization/document-lang";
import { resolveMultilingualUseCaseTerm } from "@/lib/content/search-intent/multilingual-intent";
import { computeContentPriorities } from "@/lib/content/meaning/priority-engine";
import { averageMeaningQualityScore } from "@/lib/content/meaning/quality-audit";
import { containsPiiFields } from "@/lib/content/analytics/validation";
import { getPublishedLocales, LOCALE_REGISTRY } from "@/lib/content/localization/locales";
import { computeMultilingualCoverageReports, countEnglishLeakagePages } from "@/lib/content/localization/multilingual-coverage";
import { getUiString } from "@/lib/content/localization/ui-strings";
import { getLocalizedFaqItems } from "@/lib/content/faq/localized-faq";

describe("Phase 12 content foundations", () => {
  it("classifies meaning intent", () => {
    const result = classifySearchIntent("fire meaning");
    assert.equal(result.kind, "MEANING");
    assert.equal(result.targetSlug, "fire");
  });

  it("has curated combinations foundation", () => {
    assert.ok(listPublishedCombinations().length >= 12);
  });

  it("has FAQ foundation", () => {
    assert.ok(getAllFaqItems().length >= 5);
  });

  it("labels analytics as curated", () => {
    assert.equal(ANALYTICS_MATURITY.liveEventsEnabled, false);
  });
});

describe("Phase 13 knowledge and discovery", () => {
  it("computes honest content coverage", () => {
    const report = computeKnowledgeCoverage();
    assert.equal(report.totalIdentities, 6955);
    assert.equal(report.indexableIdentities, 6953);
    assert.ok(report.richContent >= 50);
    assert.ok(report.mediumContent >= 60);
    assert.ok(report.structuredOnlyContent > 6800);
  });

  it("has search quality dataset with 2500+ cases", () => {
    assert.ok(getSearchQualityDatasetSize() >= 2650);
  });

  it("classifies combination search intent", () => {
    assert.ok(isCombinationSearchQuery("love emoji combination"));
    const slugs = searchCombinationsByIntent("love emoji combination");
    assert.ok(slugs.includes("love-sparkle"));
  });

  it("has curated collections", () => {
    assert.ok(listPublishedCollections().length >= 20);
  });

  it("builds content graph with stable nodes", () => {
    const graph = buildContentGraph();
    assert.ok(graph.nodes.length > 20);
    assert.ok(graph.edges.length > 10);
  });

  it("provides zero-result recovery without random popular", () => {
    const recovery = buildZeroResultRecovery("zzzznotfound", 0);
    assert.equal(recovery.kind, "no_result");
    assert.ok(recovery.suggestions.length > 0);
    assert.ok(recovery.didYouMean === undefined || typeof recovery.didYouMean === "string");
  });

  it("uses curated trending fallback", () => {
    assert.equal(TRENDING_LABEL, "TRENDING / CURATED");
    assert.ok(getTrendingItems("today").every((i) => i.source === "curated"));
  });

  it("has unicode history foundation", () => {
    assert.ok(listUnicodeVersions().length >= 5);
  });

  it("has platform information foundation", () => {
    assert.ok(listPlatforms().length >= 5);
  });

  it("classifies natural language use cases", () => {
    const birthday = classifySearchIntent("emoji for birthday");
    assert.equal(birthday.kind, "USE_CASE");
    const intent = classifySearchIntent("emoji that means love");
    assert.ok(intent.kind === "USE_CASE" || intent.kind === "MEANING");
  });

  it("has expanded FAQ knowledge base", () => {
    assert.ok(getAllFaqItems().length >= 30);
  });

  it("computes content priority opportunities", () => {
    const priorities = computeContentPriorities(20);
    assert.ok(priorities.length > 0);
    assert.ok(priorities.some((p) => p.slug === "fire"));
  });

  it("scores meaning quality", () => {
    assert.ok(averageMeaningQualityScore() >= 50);
  });

  it("resolves localized keywords", () => {
    assert.equal(findCanonicalIdByLocalizedKeyword("corazon", "es"), "unicode:2764");
    assert.equal(findCanonicalIdByLocalizedKeyword("fuego", "es"), "unicode:1F525");
    assert.equal(findCanonicalIdByLocalizedKeyword("cumpleanos", "es"), "unicode:1F389");
  });
});

describe("Phase 14 content maturity", () => {
  it("recovers misspellings in zero results", () => {
    const recovery = buildZeroResultRecovery("congradulations", 0);
    assert.equal(recovery.kind, "misspelling");
    assert.equal(recovery.didYouMean, "congratulations");
  });

  it("detects nonsense search queries", () => {
    assert.ok(isNonsenseQuery("zzzzzzzz"));
    assert.equal(isNonsenseQuery("heart"), false);
    const recovery = buildZeroResultRecovery("zzzzzzzz", 0);
    assert.equal(recovery.kind, "no_result");
    assert.equal(recovery.didYouMean, undefined);
  });

  it("rejects PII in analytics payloads", () => {
    assert.ok(containsPiiFields({ events: [{ email: "a@b.com" }] }));
  });

  it("builds complete hreflang set for published slug", () => {
    const langs = getPublishedHreflangLanguages("fire");
    assert.ok(langs.includes("en"));
    assert.ok(langs.includes("es"));
    assert.ok(langs.includes("fr"));
    assert.ok(langs.includes("hi"));
    assert.ok(langs.includes("de"));
    assert.ok(langs.includes("pt"));
    assert.ok(langs.includes("ja"));
  });
});

describe("Phase 16 growth and knowledge", () => {
  it("has expanded search quality dataset", () => {
    assert.ok(getSearchQualityDatasetSize() >= 2680);
  });

  it("computes priority bands in coverage report", () => {
    const report = computeKnowledgeCoverage();
    assert.ok(report.priorityBandCounts.P0 > 0);
    assert.equal(report.analyticsRankingLabel, "POPULAR / CURATED");
    assert.ok(report.localizedPageCount >= 34);
  });

  it("has rich editorial for P0 enhancements", () => {
    const report = computeKnowledgeCoverage();
    assert.ok(report.richContent >= 53);
  });

  it("has expanded combinations and FAQ", () => {
    assert.ok(listPublishedCombinations().length >= 15);
    assert.ok(getAllFaqItems().length >= 33);
  });

  it("classifies Phase 16 natural language queries", () => {
    assert.equal(classifySearchIntent("sad face").targetSlug, "crying-face");
    assert.equal(classifySearchIntent("thank you emoji").kind, "USE_CASE");
    assert.equal(resolveMultilingualUseCaseTerm("emoji merci", "fr"), "thank you");
    assert.equal(resolveMultilingualUseCaseTerm("emoji obrigado", "pt"), "thank you");
  });
});

describe("Phase 15 multilingual finalization", () => {
  it("parses document lang from localized paths", () => {
    assert.equal(parseDocumentLangFromPathname("/es/emoji/fire"), "es");
    assert.equal(parseDocumentLangFromPathname("/emoji/fire"), "en");
  });

  it("builds search href with lang parameter", () => {
    assert.equal(buildSearchHref("fuego", "es"), "/search?q=fuego&lang=es");
    assert.equal(buildSearchHref("fire", "en"), "/search?q=fire");
  });

  it("classifies Spanish natural-language intent", () => {
    const intent = classifySearchIntent("emoji para cumpleanos", "es");
    assert.equal(intent.kind, "USE_CASE");
  });

  it("resolves multilingual use case terms", () => {
    assert.equal(resolveMultilingualUseCaseTerm("emoji de amor", "es"), "love");
    assert.equal(resolveMultilingualUseCaseTerm("emoji feu", "fr"), "fire");
  });
});

describe("Phase 17 multilingual platform", () => {
  it("has unified locale registry with published locales", () => {
    const published = getPublishedLocales();
    assert.ok(published.length >= 6);
    assert.equal(LOCALE_REGISTRY.es.nativeName, "Español");
    assert.equal(LOCALE_REGISTRY.ar.direction, "rtl");
  });

  it("has expanded multilingual search dataset", () => {
    assert.ok(getSearchQualityDatasetSize() >= 5000);
  });

  it("computes per-language coverage reports", () => {
    const reports = computeMultilingualCoverageReports();
    assert.ok(reports.some((r) => r.code === "es" && r.publishedPages >= 10));
    assert.equal(countEnglishLeakagePages(), 0);
  });

  it("provides localized UI strings without English for es nav", () => {
    assert.equal(getUiString("nav.browse", "es"), "Explorar");
    assert.notEqual(getUiString("nav.browse", "es"), "Browse");
  });

  it("has localized FAQ architecture", () => {
    assert.ok(getLocalizedFaqItems("es").length >= 2);
  });

  it("resolves native-script multilingual intent", () => {
    assert.equal(resolveMultilingualUseCaseTerm("誕生日 絵文字", "ja"), "birthday");
    assert.equal(resolveMultilingualUseCaseTerm("जन्मदिन इमोजी", "hi"), "birthday");
    assert.equal(resolveMultilingualUseCaseTerm("emoji que significa amor", "es"), "love");
  });

  it("resolves document lang with search param precedence", () => {
    assert.equal(resolveDocumentLang("/search", "fr"), "fr");
    assert.equal(resolveDocumentLang("/es/emoji/fire", null), "es");
  });

  it("has more localized pages after Phase 17 expansion", () => {
    const report = computeKnowledgeCoverage();
    assert.ok(report.localizedPageCount >= 45);
  });
});
