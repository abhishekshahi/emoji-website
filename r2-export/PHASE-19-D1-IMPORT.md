# Phase 19 D1 Import
**Target:** 50979 kaomoji, 392904 relationships
## Table order
- category
- keyword
- kaomoji
- kaomoji_category
- kaomoji_keyword
- collection
- collection_item
- relationship
- search_metadata
- kaomoji_locale
- source_attribution
- production_release
## Batch strategy
- Kaomoji: 25 rows/batch (2040 batches)
- Relationships: 100 rows/batch (~3930 batches)
- Sequential execution only
| Field | Value |
|-------|-------|
| D1 database | emojiquick-kaomoji |
| Schema | migrations/kaomoji/0001_schema.sql |
| SQL files | 7535 |
| Import complete | yes |
| Final manifest | phase19-d1-import-final.json |