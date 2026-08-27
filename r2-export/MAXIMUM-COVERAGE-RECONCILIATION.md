# Maximum Coverage — Independent Reconciliation

**Timestamp:** 2026-08-23T16:34:34.010Z

## OLD baseline (unchanged)

| Metric | Count |
|--------|------:|
| Canonical | 63,248 |
| Public | 50,979 |
| Blocked | 12,269 |
| Relationships | 3,92,904 |

## Reconciliation result

| Metric | Value |
|--------|------:|
| Proposed promotions reviewed | 359 |
| **Independently validated (newly eligible)** | **359** |
| Failed independent validation | 0 |
| **new_public_expected** | **51,338** (= 50,979 + 359) |
| **remaining_blocked** | **11,910** (= 12,269 − 359) |
| Reconciliation passes | YES |

## Safety status

- SQL executed: **NO**
- Expected counts modified: **NO** (checkpoint preserved)
- Remote D1 modified: **NO**
- RAW SHA-256 unchanged: **YES**

## Eligibility path (all 359 records)

| Path | Count | Description |
|------|------:|-------------|
| A | 359 | Near-duplicate review resolved: unique content, license APPROVED, provenance COMPLETE, curation REVIEW→KEEP_CANDIDATE |
| B | 7 | Registry license resolution |

## Per-record evidence

See `data/kaomoji/processed/final/maximum-coverage-reconciliation.json` for all 359 records with:
- canonical_id, slug, kaomoji
- previous/new publication and curation status
- license, provenance, curation evidence
- quality bucket/score
- gate before/after
- exact eligibility reason

## Proposed count changes (NOT APPLIED — pending approval)

| Constant | Before | After (if approved) |
|----------|-------:|--------------------:|
| EXPECTED_KAOMOJI | 50,979 | 51,338 |
| EXPECTED_RELATIONSHIPS | 392,904 | TBD after relationship rebuild audit |
| kaomoji_category | 131,314 | TBD |
| kaomoji_keyword | 383,621 | TBD |
| kaomoji_locale | 198,799 | TBD |
| source_attribution | 60,165 | TBD |

**Relationship delta must be computed from independent relationship audit before updating EXPECTED_RELATIONSHIPS.**

## Next steps (blocked until reconciliation approved)

1. User validates per-record evidence
2. Relationship delta audit (separate from count patching)
3. Update expected counts from measured deltas only
4. Generate incremental SQL (transaction/batched)
5. Execute SQL
6. Independently query remote D1
7. Verify no duplicates, orphans, or publication leaks
