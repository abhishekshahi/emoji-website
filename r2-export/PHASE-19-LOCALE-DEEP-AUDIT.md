# Phase 19 Locale Deep Audit

**Audit timestamp:** 2026-08-20T08:50:00.000Z  
**Verdict:** PASS

## 198,942 vs 198,799 Reconciliation

| Metric | Value |
|--------|-------|
| D1 total rows | 198,799 |
| D1 unique (locale, canonical_id, field_key) | 198,799 |
| Export SQL value-lines | 198,942 |
| Export unique keys | 198,799 |
| Multiline continuation lines | 143 |

**Explanation:** 198,942 physical SQL value-lines include 143 lines that are continuations of multi-line `field_value` strings (embedded newlines in kaomoji content), not separate database rows. D1 stores exactly 198,799 unique primary-key rows.

Example: records `kao_45ca69b73e510a92` and `kao_45d80596a904a64c` confirmed present in D1.

## Per-Locale Counts (D1 Live)

| Locale | Count | Notes |
|--------|-------|-------|
| en | 198,793 | Primary locale — per-record translations |
| de | 1 | Registry/UI row |
| es | 1 | Registry/UI row |
| fr | 1 | Registry/UI row |
| hi | 1 | Registry/UI row |
| ja | 1 | Registry/UI row |
| pt | 1 | Registry/UI row |
| **Total** | **198,799** | |

## 11 Locales vs 7 D1 Locales

Phase 15 design (manifest):

- **supported_locales:** 11 (en, hi, es, fr, de, pt, it, ja, ko, zh, ar)
- **published_locales:** 7 (present in D1 kaomoji_locale)
- **review_required_locales:** 4 (it, ko, zh, ar — UI bundles in locale-registry only)

This is expected architecture, not a data defect.

## Integrity

- duplicate locale PKs: 0
- orphan locale rows (non-empty canonical_id): 0 (integrity audit)
