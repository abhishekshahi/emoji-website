# Phase 19 Cross-Layer Consistency Audit

**Audit timestamp:** 2026-08-20T08:50:00.000Z  
**Verdict:** PASS

## Conservation Chain

| Layer | Count | Matches Next Layer |
|-------|-------|-------------------|
| RAW | 236,508 | unchanged (SHA verified) |
| Canonical | 63,248 | preserved |
| Quality-qualified | 63,181 | preserved |
| Public (editorial) | 50,979 | = D1 kaomoji |
| D1 kaomoji | 50,979 | PASS |
| D1 relationships | 392,904 | = Phase 12 |
| D1 categories | 131,314 | = export |
| D1 keywords | 383,621 | = export |
| D1 locales | 198,799 | = export unique keys |
| R2 search index | 50,979 IDs | = public |
| Worker API | 50,979 public | canonical audit PASS |

## Excluded (Not in Production)

| Category | Count |
|----------|-------|
| Publication-blocked | 12,202 |
| INVALID excluded | 66 |
| LOW excluded | 1 |
| FastEmoji drift | 3,825 (outside canonical layer) |

## Duplicate / Variant Preservation

| Metric | Value |
|--------|-------|
| Duplicate groups | 49,885 |
| Variant groups | 15,143 |
| Legitimate variants | 2,533 |
| Provenance coverage | 100% |

## Report Accuracy

Compared live values against `phase19-d1-import-final.json` and `PHASE-19-FINAL.md`:

- All D1 counts match
- All gate results match
- No material discrepancies found

## Popularity

INSUFFICIENT_DATA — consistent across RAW → canonical → D1 → Worker. No fabricated events.
