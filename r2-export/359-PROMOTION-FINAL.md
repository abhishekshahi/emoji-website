# 359 Promotion — Final Report

**Timestamp:** 2026-08-23T21:05:00.000Z  
**Status:** COMPLETE — all verification gates passed

---

## Executive Summary

```
==================================================
MAXIMUM LEGITIMATE PUBLIC COVERAGE ACHIEVED
==================================================
Previous public:     50,979
Newly promoted:         359
Final public:        51,338
Canonical:           63,248
Remaining blocked:   11,910
Unresolved:               0
```

The 359 independently validated records were promoted via incremental SQL (no `--fresh`, no RAW modification, no canonical dataset modification). All 50,979 pre-existing public records were preserved.

---

## Promotion Breakdown

| Path | Count | Description |
|------|------:|-------------|
| Path A | 352 | Near-duplicate curation review resolved |
| Path B | 7 | Wikipedia `ATTRIBUTION_REQUIRED` with attribution |
| **Total** | **359** | 359/359 independently validated |

---

## Table Deltas (BEFORE + INSERTS − DELETES = AFTER)

| Table | Before | Inserts | Deletes | After |
|-------|-------:|--------:|--------:|------:|
| kaomoji | 50,979 | 359 | 0 | **51,338** |
| relationship | 392,904 | 3,258 | 0 | **396,162** |
| category | 56 | 0 | 0 | 56 |
| keyword | 998 | 0 | 0 | 998 |
| kaomoji_category | 131,314 | 925 | 0 | **132,239** |
| kaomoji_keyword | 383,621 | 2,819 | 0 | **386,440** |
| kaomoji_locale | 198,799 | 1,416 | 0 | **200,215** |
| source_attribution | 60,165 | 406 | 0 | **60,571** |
| search_metadata | 4 | 0 | 0 | 4 |
| collection | 20 | 0 | 0 | 20 |
| collection_item | 4,400 | 0 | 0 | 4,400 |
| production_release | 1 | 0 | 0 | 1 |

### Relationship policy

329 relationship DELETEs proposed by the phase-12 rebuild were **rejected**. They would have pruned valid existing-public hub edges to `kao_643ba83911238b9b` (`(=•ᴥ•=)🐾`). D1 import used **INSERT-ONLY** for relationships.

- Library relationships (authoritative JSON): 395,833
- D1 relationships (measured): 396,162
- Preserved hub edges not in rebuilt JSON: 329

### Locale note

Preflight projected 1,419 locale inserts; measured after = 200,215 (3 fewer due to `INSERT OR IGNORE` duplicates). Nineteen records missing locales were repaired via `locale-repair.sql` (73 rows).

---

## Remote D1 Verification

**Timestamp:** 2026-08-23T21:02:14.882Z  
**Result:** `verification_passes: true`

| Check | Result |
|-------|--------|
| kaomoji count | 51,338 |
| is_public = 1 | 51,338 |
| 359 promoted exist | 359/359 |
| 359 promoted is_public | 359/359 |
| Wikipedia attribution | 7/7 |
| Searchable (local index) | 359/359 |
| Duplicate kaomoji | 0 |
| Orphan relationships | 0 |
| Canonical count | 63,248 |
| RAW count | 236,508 |
| RAW SHA256 | `fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf` (unchanged) |

---

## Wikipedia Attribution (7 records)

All verified in D1 `source_attribution`:

- `kao_1c20b20807593325`
- `kao_4ec890fc486eb81a`
- `kao_606d42f69781fc0b`
- `kao_969f17fb8c0d495f`
- `kao_b8497b96e26608ca`
- `kao_ed7fed7d4920fbe0`
- `kao_fa2aed3d508448cc`

---

## Build & Deployment

| Item | Value |
|------|-------|
| `npm run build` | PASS (7,576 static pages) |
| `npm run build:cf` | PASS |
| Deploy command | `npm run deploy:cf` |
| Worker URL | https://emoji-website.emoji-website.workers.dev |
| Deployment ID | `ec27b790-d543-4309-86ea-02d406547130` |
| **BUILD_ID (live)** | **`yFlpfotHYEMHeOyc1sjsC`** |

### R2 upload

- search-index-v2.json — `91e5f9387675…`
- manifest.json — `a1547c9ba785…`
- 5 objects uploaded, verification 4/4

---

## Live Post-Deploy Verification

| Check | Result |
|-------|--------|
| Worker smoke | 13/13 |
| Promoted detail (Path A sample) | 200 — JSON-LD, canonical, related |
| Promoted detail (Wikipedia) | 200 — attribution present |
| Blocked fake slug | 404 |
| Blocked real (`kao-000c332b7e7b5b52`) | 404 |
| Search API | 200 |
| Sitemap | 200 |
| Collections pagination | 200 |
| Security headers | X-Frame-Options: SAMEORIGIN, Referrer-Policy: strict-origin-when-cross-origin |

---

## Test Gates

| Gate | Result |
|------|--------|
| typecheck | PASS |
| Phase 19 tests | 60/60 |
| Phase 20 tests | 50/50 (search benchmark 122/122) |
| Phase 21 tests | 50/50 |
| Phase 22 | **NOT STARTED** (per instruction) |

---

## Artifacts

- Preflight: `data/kaomoji/processed/final/359-promotion-preflight.json`
- Post-verify: `data/kaomoji/processed/final/359-promotion-post-verify.json`
- Final JSON: `data/kaomoji/processed/final/359-promotion-final.json`
- Incremental SQL: `data/kaomoji/processed/final/d1-incremental/` (273 files)
- Curation resolutions: `data/kaomoji/processed/final/curation-resolutions.json`
- Promotion decisions: `data/kaomoji/processed/final/promotion-decisions.json`

---

## Remaining Blocked (11,910)

These records remain legitimately blocked pending license evidence (messletters, kaomoji-json, fastemoji sources). They were **not** part of this promotion and continue to return 404 on detail pages.

Phase 22 was **not** started.
