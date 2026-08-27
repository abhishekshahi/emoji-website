# PHASE STEP 8 — Kaomoji Trending / Popular Rankings

**Status:** Implementation complete — **FINAL VERIFIED blocked pending production deploy and live audits**

**Branch:** `cursor/359-kaomoji-promotion`  
**Production (pre-deploy):** https://emojiquick.com  
**Pre-deploy BUILD_ID:** `jBTM3zuDHiOQZYEJ23nV8`

---

## Summary

Step 8 adds honest kaomoji popularity and trending discovery using **real R2 daily analytics aggregates** when the readiness gate passes (≥1,000 events). Until then, the UI shows **editorial featured picks** with explicit `INSUFFICIENT_DATA` labeling — never fabricated view or copy counts.

---

## Top-20 Research (abbreviated)

| Site | Ranking approach |
|------|------------------|
| [Kaomojis.jp ranking](https://kaomojis.jp/en/ranking) | Real copy events, 7-day rolling, methodology published |
| [Kaomojis.jp usage reports](https://kaomojis.jp/en/reports/kaomoji-usage/2026-05) | Monthly aggregated copy reports |
| [Kaomojis.jp search](https://kaomojis.jp/en/search) | Trending strip + popular search terms |
| JapaneseEmoticons.me | Category-first static lists |
| Emojipedia / Unicode | Reference — no item-level popularity |
| EmojiQuick Phase 18 | R2 ingest + readiness gate (1,000 events) |

Full list: `data/kaomoji/processed/final/phase-step-8-trending-popular-final.json`

---

## Available Signals

| Signal | Wired | Storage |
|--------|-------|---------|
| `kaomoji_copy` | ✅ detail + card | R2 daily aggregate |
| `kaomoji_view` | ✅ view tracker | R2 daily aggregate |
| `kaomoji_favorite` | ✅ detail + card | R2 daily aggregate |
| `kaomoji_share` | ✅ detail | R2 daily aggregate |
| `kaomoji_search` | ✅ validation | R2 daily aggregate |

**Gate:** `ANALYTICS_MATURITY.liveEventsEnabled = false`, `minimumEventsForTrending = 1000`. Current production aggregate volume is below threshold → **Featured fallback**.

---

## Ranking Methodology

### Popular (30d / 7d)
Weighted score: copy×3, favorite×2, share×2, view×1, search×0.5. Public D1 resolution only. Rank labels shown; counts hidden.

### Trending (7d)
Same weighted score over recent window — **not** lifetime totals.

### Rising (7d vs prior 7d)
Positive activity delta only when live data ready.

### Most Copied
`kaomoji_copy` metric only.

### Category featured
Live activity filtered to category; ≥3 live hits required, else editorial quality picks.

### Anti-manipulation
- 30s client dedupe per event kind + canonical ID
- Daily server aggregation (not raw event replay)
- API rate limits + parameter sanitization
- No single-user inflation via repeated refresh (dedupe)

---

## Implementation

| Area | Files |
|------|-------|
| Scoring | `src/lib/kaomoji/rankings/scoring.ts`, `types.ts`, `sanitize.ts` |
| D1 rankings | `src/lib/kaomoji/cloudflare/d1-rankings.ts` |
| API | `/api/kaomoji/popular`, `/api/kaomoji/trending` |
| Pages | `/kaomoji/popular`, `/kaomoji/trending` |
| Hub | `KaomojiHubRankings` on `/kaomoji` |
| Homepage | `KaomojiHomeDiscovery` |
| Detail badge | `KaomojiRankingBadge` (rank only, no fake metrics) |
| Sitemap | `/kaomoji/popular`, `/kaomoji/trending` |
| Tests | `kaomoji-step8-trending-popular.test.ts` (12/12) |
| Live audit script | `scripts/kaomoji/step8-deep-live-audit.ts` |

---

## Data Integrity

No D1 publication changes. Baseline unchanged:

- Canonical: 63,248
- Public: 51,338
- Blocked: 11,910
- RAW: 236,508
- Relationships: 396,162

---

## Tests

| Suite | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| Step 8 (12 tests) | PASS |
| Step 7 (11 tests) | PASS |
| Search benchmark | 122/122 (when index present) |
| Phase 19–21 | Data artifacts missing in cloud VM |

---

## Deploy / Audits

**Deploy:** BLOCKED — `CLOUDFLARE_API_TOKEN` not set.

**Required before FINAL VERIFIED:**
1. `npm run build` + `npm run build:cf` — PASS
2. Deploy to production
3. First deep live audit (`scripts/kaomoji/step8-deep-live-audit.ts`)
4. Fix CRITICAL/HIGH/MEDIUM
5. Redeploy
6. Second independent audit (`--second`)

---

## Regression Notes

- Search ranking unchanged (semantic primary)
- Step 7 related/similar preserved
- Steps 1–6 generator, variations, meaning, collections unchanged
- Publication gates unchanged; blocked records excluded from all ranking queries

---

**STEP 8 — KAOMOJI TRENDING / POPULAR RANKINGS: NOT YET FINAL VERIFIED (deploy pending)**
