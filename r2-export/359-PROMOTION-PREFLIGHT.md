# 359 Promotion Preflight

**Timestamp:** 2026-08-23T16:45:01.195Z
**Preflight passes:** YES

## Baseline

| Metric | Value |
|--------|------:|
| Canonical | 63,248 |
| Public (before) | 50,979 |
| Newly eligible | 359 |
| **Proposed public** | **51,338** |
| Remaining blocked | 11,910 |

## Table deltas (BEFORE + INSERTS − DELETES = EXPECTED AFTER)

| Table | Before | Inserts | Deletes | Expected After |
|-------|-------:|--------:|--------:|---------------:|
| kaomoji | 50,979 | 359 | 0 | 51,338 |
| relationship | 3,92,904 | 3,258 | 0 | 3,96,162 |
| category | 56 | 0 | 0 | 56 |
| keyword | 998 | 0 | 0 | 998 |
| kaomoji_category | 1,31,314 | 925 | 0 | 1,32,239 |
| kaomoji_keyword | 3,83,621 | 2,819 | 0 | 3,86,440 |
| kaomoji_locale | 1,98,799 | 1,419 | 0 | 2,00,218 |
| source_attribution | 60,165 | 406 | 0 | 60,571 |
| search_metadata | 4 | 0 | 0 | 4 |
| collection | 20 | 0 | 0 | 20 |
| collection_item | 4,400 | 0 | 0 | 4,400 |
| production_release | 1 | 0 | 0 | 1 |

## Relationship audit

- Before: 3,92,904
- After (authoritative): 3,95,833
- Inserts (all new keys): 3,258
- Inserts (promoted-involved): 3,258
- Deletes (rebuild diff): 329
- Delete mode: INSERT-ONLY (deletes not justified)

## Search

- Benchmark: 122/122
- Index records: 51,338
- Promoted searchable: 359/359

## Wikipedia attribution (7 records)

- `kao_1c20b20807593325`: OK (wikipedia, wikipedia)
- `kao_4ec890fc486eb81a`: OK (wikipedia, wikipedia)
- `kao_606d42f69781fc0b`: OK (wikipedia, wikipedia)
- `kao_969f17fb8c0d495f`: OK (wikipedia, wikipedia)
- `kao_b8497b96e26608ca`: OK (wikipedia, wikipedia)
- `kao_ed7fed7d4920fbe0`: OK (wikipedia, wikipedia)
- `kao_fa2aed3d508448cc`: OK (wikipedia, wikipedia)

## SQL review

- Files: 273
- Issues: 0

## Errors

None
