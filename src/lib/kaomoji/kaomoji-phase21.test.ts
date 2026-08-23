import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, before } from "node:test";
import { EXPECTED_KAOMOJI, EXPECTED_RELATIONSHIPS } from "@/lib/kaomoji/cloudflare/d1-import";
import {
  auditAnalytics,
  auditPhase19Gate,
  auditPhase20Gate,
  auditRollbackManifest,
  auditRouteFiles,
  KAOMOJI_LOCALES,
  KAOMOJI_PUBLIC_ROUTES,
} from "@/lib/kaomoji/processing/phase21/audits";
import { runPhase21Pipeline } from "@/lib/kaomoji/processing/phase21/pipeline";
import { PHASE21_QA_VERSION, PRODUCTION_DATA_COUNTS } from "@/lib/kaomoji/processing/phase21/types";
import { getPhase21ManifestPath, getPhase21RootDir, PHASE21_PIPELINE_VERSION } from "@/lib/kaomoji/storage/paths";

describe("phase 21 production qa launch", () => {
  const root = process.cwd();

  before(() => {
    runPhase21Pipeline(root, { typecheckPassed: true, buildPassed: true });
  });

  const m = () => JSON.parse(readFileSync(getPhase21ManifestPath(root), "utf8"));

  it("1 manifest exists", () => assert.ok(existsSync(getPhase21ManifestPath(root))));
  it("2 phase number", () => assert.equal(m().phase, 21));
  it("3 pipeline version", () => assert.match(m().pipeline_version, /^21\./));
  it("4 qa version", () => assert.equal(m().qa_version, PHASE21_QA_VERSION));
  it("5 public count 50979", () => assert.equal(m().data_counts.public, 50979));
  it("6 relationships 392904", () => assert.equal(m().data_counts.relationships, 392904));
  it("7 raw 236508", () => assert.equal(m().data_counts.raw, 236508));
  it("8 fastemoji drift 3825", () => assert.equal(m().data_counts.fastemoji_drift, 3825));
  it("9 canonical 63248", () => assert.equal(m().data_counts.canonical, 63248));
  it("10 quality qualified 63181", () => assert.equal(m().data_counts.quality_qualified, 63181));
  it("11 duplicate groups 49885", () => assert.equal(m().data_counts.duplicate_groups, 49885));
  it("12 variant groups 15143", () => assert.equal(m().data_counts.variant_groups, 15143));
  it("13 legitimate variants 2533", () => assert.equal(m().data_counts.legitimate_variants, 2533));
  it("14 locales 11", () => assert.equal(m().locales.length, 11));
  it("15 locales include en", () => assert.ok(m().locales.includes("en")));
  it("16 locales include ja", () => assert.ok(m().locales.includes("ja")));
  it("17 locales include ar", () => assert.ok(m().locales.includes("ar")));
  it("18 hreflang count", () => assert.equal(m().seo.hreflang_locales, 11));
  it("19 sitemap expected urls", () => assert.equal(m().seo.sitemap_expected_urls, 50979));
  it("20 json ld routes", () => assert.equal(m().seo.json_ld_routes, true));
  it("21 popularity insufficient", () => assert.equal(m().analytics.popularity_status, "INSUFFICIENT_DATA"));
  it("22 analytics events wired", () => assert.ok(m().analytics.events_wired.length >= 5));
  it("23 rollback manifest exists", () => assert.equal(m().rollback.rollback_manifest_exists, true));
  it("24 routes audited non-empty", () => assert.ok(m().routes_audited.length >= 3));
  it("25 public routes constant", () => assert.ok(KAOMOJI_PUBLIC_ROUTES.length >= 4));
  it("26 locale constant count", () => assert.equal(KAOMOJI_LOCALES.length, 11));
  it("27 production data counts constant", () => assert.equal(PRODUCTION_DATA_COUNTS.public, EXPECTED_KAOMOJI));
  it("28 expected relationships match", () => assert.equal(PRODUCTION_DATA_COUNTS.relationships, EXPECTED_RELATIONSHIPS));
  it("29 route audit finds kaomoji", () => assert.ok(auditRouteFiles(root).some((r) => r.includes("kaomoji"))));
  it("30 route audit finds search api", () => assert.ok(auditRouteFiles(root).includes("/api/kaomoji/search")));
  it("31 analytics audit popularity", () => assert.equal(auditAnalytics(root).popularity, "INSUFFICIENT_DATA"));
  it("32 rollback audit", () => assert.equal(auditRollbackManifest(root), true));
  it("33 phase20 gate local", () => assert.equal(auditPhase20Gate(root), true));
  it("34 phase19 gate local manifest", () => assert.equal(auditPhase19Gate(root, false), true));
  it("35 config manifest written", () => assert.ok(existsSync(join(getPhase21RootDir(root), "manifest.json"))));
  it("36 pipeline version constant", () => assert.match(PHASE21_PIPELINE_VERSION, /^21\./));
  it("37 gates object present", () => assert.ok(typeof m().gates.phase20 === "boolean"));
  it("38 errors array", () => assert.ok(Array.isArray(m().errors)));
  it("39 warnings array", () => assert.ok(Array.isArray(m().warnings)));
  it("40 timestamp iso", () => assert.ok(!Number.isNaN(Date.parse(m().timestamp))));
  it("41 deterministic rerun routes", () => {
    const before = m().routes_audited.length;
    const after = runPhase21Pipeline(root).manifest.routes_audited.length;
    assert.equal(before, after);
  });
  it("42 kaomoji hub page exists", () => assert.ok(existsSync(join(root, "src/app/kaomoji/page.tsx"))));
  it("43 homepage exists", () => assert.ok(existsSync(join(root, "src/app/page.tsx"))));
  it("44 events include copy", () => assert.ok(m().analytics.events_wired.includes("kaomoji_copy")));
  it("45 events include search", () => assert.ok(m().analytics.events_wired.includes("kaomoji_search")));
  it("46 events include view", () => assert.ok(m().analytics.events_wired.includes("kaomoji_view")));
  it("47 events include favorite", () => assert.ok(m().analytics.events_wired.includes("kaomoji_favorite")));
  it("48 events include share", () => assert.ok(m().analytics.events_wired.includes("kaomoji_share")));
  it("49 previous release flag", () => assert.equal(typeof m().rollback.previous_release_exists, "boolean"));
  it("50 production counts frozen", () => assert.deepEqual(m().data_counts, PRODUCTION_DATA_COUNTS));
});
