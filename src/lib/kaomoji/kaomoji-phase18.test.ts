import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ANALYTICS_MATURITY } from "@/lib/content/analytics/events";
import { getKaomojiPopularity } from "@/lib/kaomoji/analytics/popularity";
import { getKaomojiTrending } from "@/lib/kaomoji/analytics/trending";
import { runPhase18Pipeline } from "@/lib/kaomoji/processing/phase18/pipeline";
import { getPhase18ManifestPath, getPhase18RootDir } from "@/lib/kaomoji/storage/paths";

describe("phase 18 analytics popularity", () => {
  const root = process.cwd();
  const m = () => JSON.parse(readFileSync(getPhase18ManifestPath(root), "utf8"));

  it("1 manifest exists", () => assert.ok(existsSync(getPhase18ManifestPath(root))));
  it("2 phase number", () => assert.equal(m().phase, 18));
  it("3 popularity insufficient", () => assert.equal(m().popularity_status, "INSUFFICIENT_DATA"));
  it("4 trending insufficient", () => assert.equal(m().trending_status, "INSUFFICIENT_DATA"));
  it("5 anti abuse enabled", () => assert.equal(m().anti_abuse_enabled, true));
  it("6 minimum events 1000", () => assert.equal(m().minimum_events_for_trending, 1000));
  it("7 no errors", () => assert.equal(m().errors.length, 0));
  it("8 analytics version", () => assert.match(m().analytics_version, /^18\./));
  it("9 events wired 5", () => assert.equal(m().events_wired.length, 5));
  it("10 kaomoji_search wired", () => assert.ok(m().events_wired.includes("kaomoji_search")));
  it("11 kaomoji_view wired", () => assert.ok(m().events_wired.includes("kaomoji_view")));
  it("12 kaomoji_copy wired", () => assert.ok(m().events_wired.includes("kaomoji_copy")));
  it("13 kaomoji_favorite wired", () => assert.ok(m().events_wired.includes("kaomoji_favorite")));
  it("14 kaomoji_share wired", () => assert.ok(m().events_wired.includes("kaomoji_share")));
  it("15 live events disabled", () => assert.equal(ANALYTICS_MATURITY.liveEventsEnabled, false));
  it("16 popularity label curated", () => {
    const p = getKaomojiPopularity("kaomoji:test");
    assert.equal(p.status, "INSUFFICIENT_DATA");
    assert.equal(p.label, "POPULAR / CURATED");
  });
  it("17 trending empty curated", () => {
    const t = getKaomojiTrending(10);
    assert.equal(t.status, "INSUFFICIENT_DATA");
    assert.equal(t.items.length, 0);
  });
  it("18 trending label", () => assert.equal(getKaomojiTrending().label, "TRENDING / CURATED"));
  it("19 analytics config file", () => assert.ok(existsSync(join(getPhase18RootDir(root), "analytics-config.json"))));
  it("20 config no fabrication", () => {
    const c = JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8"));
    assert.equal(c.antiAbuse.noFabrication, true);
  });
  it("21 config rate limit", () => {
    const c = JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8"));
    assert.equal(c.antiAbuse.rateLimit, true);
  });
  it("22 config pii blocked", () => {
    const c = JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8"));
    assert.equal(c.antiAbuse.piiBlocked, true);
  });
  it("23 config events match manifest", () => {
    const c = JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8"));
    assert.deepEqual([...c.events].sort(), [...m().events_wired].sort());
  });
  it("24 config live disabled", () => {
    const c = JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8"));
    assert.equal(c.liveEventsEnabled, false);
  });
  it("25 config minimum threshold", () => {
    const c = JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8"));
    assert.equal(c.minimumEventsForTrending, 1000);
  });
  it("26 deterministic rerun", () => {
    const before = m().events_wired.length;
    assert.equal(runPhase18Pipeline(root).manifest.events_wired.length, before);
  });
  it("27 pipeline version", () => assert.match(m().pipeline_version, /^18\./));
  it("28 popularity ranking label", () => {
    const c = JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8"));
    assert.equal(c.popularityLabel, "POPULAR / CURATED");
  });
  it("29 ingest enabled maturity", () => assert.equal(ANALYTICS_MATURITY.ingestEnabled, true));
  it("30 maturity minimum 1000", () => assert.equal(ANALYTICS_MATURITY.minimumEventsForTrending, 1000));
  it("31 trending limit param", () => assert.equal(getKaomojiTrending(5).items.length, 0));
  it("32 popularity no rank when insufficient", () => assert.equal(getKaomojiPopularity("kaomoji:x").status, "INSUFFICIENT_DATA"));
  it("33 manifest warnings array", () => assert.ok(Array.isArray(m().warnings)));
  it("34 events no emoji kinds", () => assert.ok(m().events_wired.every((e: string) => e.startsWith("kaomoji_"))));
  it("35 config events count 5", () => {
    const c = JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8"));
    assert.equal(c.events.length, 5);
  });
  it("36 popularity no copy count live off", () => {
    const p = getKaomojiPopularity("kaomoji:abc");
    assert.equal(p.copyCount, undefined);
  });
  it("37 trending source live off empty", () => assert.equal(getKaomojiTrending().items.length, 0));
  it("38 analytics maturity label", () => assert.equal(ANALYTICS_MATURITY.rankingLabel, "POPULAR / CURATED"));
  it("39 phase 18 timestamp", () => assert.ok(m().timestamp.length > 10));
  it("40 anti abuse manifest true", () => assert.ok(m().anti_abuse_enabled));
  it("41 popularity status string", () => assert.match(m().popularity_status, /INSUFFICIENT_DATA|LIVE/));
  it("42 trending status string", () => assert.match(m().trending_status, /INSUFFICIENT_DATA|LIVE/));
  it("43 config file valid json", () => {
    assert.doesNotThrow(() => JSON.parse(readFileSync(join(getPhase18RootDir(root), "analytics-config.json"), "utf8")));
  });
  it("44 manifest file valid json", () => {
    assert.doesNotThrow(() => JSON.parse(readFileSync(getPhase18ManifestPath(root), "utf8")));
  });
  it("45 events unique", () => assert.equal(new Set(m().events_wired).size, m().events_wired.length));
  it("46 no fabricated trending items", () => assert.equal(getKaomojiTrending(20).items.length, 0));
  it("47 popularity label not live", () => assert.notEqual(getKaomojiPopularity("kaomoji:1").label, "LIVE ANALYTICS"));
  it("48 minimum matches maturity", () => assert.equal(m().minimum_events_for_trending, ANALYTICS_MATURITY.minimumEventsForTrending));
  it("49 ingest path not required for insufficient", () => assert.equal(m().popularity_status, "INSUFFICIENT_DATA"));
  it("50 pipeline no raw mutation error", () => assert.ok(!m().errors.some((e: string) => e.includes("RAW"))));
  it("51 events include search first", () => assert.equal(m().events_wired[0], "kaomoji_search"));
});
