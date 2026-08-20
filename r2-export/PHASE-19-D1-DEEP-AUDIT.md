# Phase 19 D1 Deep Audit

**Audit timestamp:** 2026-08-20T08:50:00.000Z  
**Verdict:** PASS

## Schema

Source: `migrations/kaomoji/0001_schema.sql` (SCHEMA_VERSION 19.0.0)

| Table | Primary Key | FK References |
|-------|-------------|---------------|
| kaomoji | canonical_id | — |
| category | slug | — |
| kaomoji_category | (canonical_id, category_slug) | kaomoji, category |
| keyword | keyword | — |
| kaomoji_keyword | (canonical_id, keyword, source) | kaomoji, keyword |
| relationship | id (AUTO); UNIQUE(from, to, type) | kaomoji ×2 |
| collection | slug | — |
| collection_item | (collection_slug, canonical_id) | collection, kaomoji |
| kaomoji_locale | (locale, canonical_id, field_key) | — |
| source_attribution | (canonical_id, source_id) | kaomoji |
| search_metadata | key | — |
| production_release | version | — |

Indexes verified present: slug, quality, public, category_slug, keyword, relationship from/to/type, collection_item order, locale record, source_attribution source.

## Live Row Counts (remote D1)

| Table | Live | Expected | Status |
|-------|------|----------|--------|
| kaomoji | 50,979 | 50,979 | PASS |
| relationship | 392,904 | 392,904 | PASS |
| kaomoji_category | 131,314 | 131,314 | PASS |
| kaomoji_keyword | 383,621 | 383,621 | PASS |
| kaomoji_locale | 198,799 | 198,799 | PASS |
| source_attribution | 60,165 | 60,165 | PASS |
| production_release | 1 | 1 | PASS |
| category | 56 | 56 | PASS |
| keyword | 998 | 998 | PASS |
| collection | 20 | 20 | PASS |
| collection_item | 4,400 | 4,400 | PASS |
| search_metadata | 4 | 4 | PASS |

## Duplicate Audit — PASS

| Check | Count |
|-------|-------|
| Duplicate canonical_id | 0 |
| Duplicate relationship (from, to, type) | 0 |
| Duplicate kaomoji_category PK | 0 |
| Duplicate kaomoji_keyword PK | 0 |
| Duplicate kaomoji_locale PK | 0 |

## Foreign Key Audit — PASS

| Check | Count |
|-------|-------|
| Orphan relationships | 0 |
| Broken collection_item | 0 |
| Non-public kaomoji in D1 | 0 |

Verified via `phase19-integrity-audit.ts --remote`.

## D1 Database Size

Remote size_after: ~235 MB (235,638,784 bytes as of audit query).
