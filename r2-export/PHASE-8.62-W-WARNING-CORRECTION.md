# Phase 8.62-W — Warning Correction

**Production:** https://emojiquick.com
**Audited:** 2026-08-16T21:30:34.098Z
**Deployment:** e5c9d91d-1c4b-44b3-b061-0401fef5bda2
**Rollback:** 14d16f10-90ff-47f4-9912-0a4f445e477f
**Verdict:** **PASS**

## WARNING #1 — Burst 503

| Field | Value |
|-------|-------|
| SAFE CONCURRENCY | 5 |
| 503 AT SAFE (c=5, normal load) | 0 |
| 503 AT AGGRESSIVE (c=10) | 0 |
| ROOT CAUSE | none |
| CLASSIFICATION | **EXPECTED** |

### Normal-load concurrency matrix

| C | Req | 200 | 429 | 503 | 500 | Avg TTFB | P95 TTFB |
|---|-----|-----|-----|-----|-----|----------|----------|
| 1 | 20 | 20 | 0 | 0 | 0 | 399 | 1863 |
| 2 | 20 | 20 | 0 | 0 | 0 | 266 | 1677 |
| 3 | 20 | 20 | 0 | 0 | 0 | 319 | 1609 |
| 4 | 20 | 20 | 0 | 0 | 0 | 345 | 1208 |
| 5 | 20 | 20 | 0 | 0 | 0 | 231 | 1202 |

### Aggressive-load concurrency matrix

| C | Req | 200 | 429 | 503 | 500 | Avg TTFB | P95 TTFB |
|---|-----|-----|-----|-----|-----|----------|----------|
| 6 | 30 | 30 | 0 | 0 | 0 | 434 | 1423 |
| 8 | 30 | 30 | 0 | 0 | 0 | 309 | 1298 |
| 10 | 30 | 30 | 0 | 0 | 0 | 322 | 1354 |

Persistent 5xx at safe load: 0
Persistent 503 at safe load: 0

## WARNING #2 — Noto Utility Routes

| Field | Value |
|-------|-------|
| UTILITY SLUGS | noto, noto-png-noto |
| IN SITEMAP (after fix) | none |
| SITEMAP EMOJI COUNT | 6953 (target 6953) |
| SITEMAP TOTAL | 7046 (target 7046) |
| CLASSIFICATION | **FIXED — UTILITY EXCLUDED FROM SITEMAP** |

| Slug | canonicalId | Page HTTP | Artwork API |
|------|-------------|-----------|-------------|
| noto | source:noto:noto.png | 404 | 404 |
| noto-png-noto | source:noto:noto.png:noto.png | 404 | 404 |

## Scorecard

| Gate | Result |
|------|--------|
| 6,955 canonical identities | PASS (6955) |
| 6,955 browse | PASS (6955) |
| 6,955 search | PASS (6955) |
| 6,953 indexable sitemap emoji | PASS (6953) |
| 7,046 sitemap URLs | PASS (7046) |
| 57 hubs | PASS (57) |
| Artwork / Fire | PASS |
| R2 PRIVATE | PASS |
| Security | PASS |
| SEO | PASS |
| Safe concurrency | PASS (5) |
| Utility excluded from sitemap | PASS |
| Blockers | 0 |
| Warnings | 0 |

## Sign-off

EMOJIQUICK PHASE 8.62-W = PASS

**DO NOT START 8.63**
