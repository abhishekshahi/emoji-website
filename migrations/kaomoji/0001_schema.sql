-- EmojiQuick Kaomoji Phase 19 — D1 production schema
-- SCHEMA_VERSION 19.0.0

CREATE TABLE IF NOT EXISTS kaomoji (
  canonical_id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  normalized_content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'KAOMOJI',
  publication_status TEXT NOT NULL,
  curation_status TEXT NOT NULL,
  license_status TEXT NOT NULL,
  provenance_status TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  quality_score REAL NOT NULL,
  quality_bucket TEXT NOT NULL,
  beauty_score REAL NOT NULL,
  overall_score REAL,
  editorial_name TEXT,
  accessible_name TEXT NOT NULL,
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  editorial_tier TEXT NOT NULL,
  editorial_priority TEXT NOT NULL,
  meaning TEXT,
  common_usage TEXT,
  duplicate_group_id TEXT,
  variant_group_id TEXT,
  popularity_status TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kaomoji_slug ON kaomoji(slug);
CREATE INDEX IF NOT EXISTS idx_kaomoji_quality ON kaomoji(quality_bucket, quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_kaomoji_public ON kaomoji(is_public);

CREATE TABLE IF NOT EXISTS category (
  slug TEXT PRIMARY KEY NOT NULL,
  group_name TEXT NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kaomoji_category (
  canonical_id TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  PRIMARY KEY (canonical_id, category_slug),
  FOREIGN KEY (canonical_id) REFERENCES kaomoji(canonical_id) ON DELETE CASCADE,
  FOREIGN KEY (category_slug) REFERENCES category(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kaomoji_category_slug ON kaomoji_category(category_slug);

CREATE TABLE IF NOT EXISTS keyword (
  keyword TEXT PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS kaomoji_keyword (
  canonical_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'emojiquick' CHECK (source IN ('emojiquick', 'source')),
  PRIMARY KEY (canonical_id, keyword, source),
  FOREIGN KEY (canonical_id) REFERENCES kaomoji(canonical_id) ON DELETE CASCADE,
  FOREIGN KEY (keyword) REFERENCES keyword(keyword) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kaomoji_keyword_kw ON kaomoji_keyword(keyword);

CREATE TABLE IF NOT EXISTS relationship (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_canonical_id TEXT NOT NULL,
  to_canonical_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  score REAL NOT NULL,
  UNIQUE(from_canonical_id, to_canonical_id, relationship_type),
  FOREIGN KEY (from_canonical_id) REFERENCES kaomoji(canonical_id) ON DELETE CASCADE,
  FOREIGN KEY (to_canonical_id) REFERENCES kaomoji(canonical_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relationship_from ON relationship(from_canonical_id);
CREATE INDEX IF NOT EXISTS idx_relationship_to ON relationship(to_canonical_id);
CREATE INDEX IF NOT EXISTS idx_relationship_type ON relationship(relationship_type);

CREATE TABLE IF NOT EXISTS collection (
  slug TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rule TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collection_item (
  collection_slug TEXT NOT NULL,
  canonical_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_slug, canonical_id),
  FOREIGN KEY (collection_slug) REFERENCES collection(slug) ON DELETE CASCADE,
  FOREIGN KEY (canonical_id) REFERENCES kaomoji(canonical_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collection_item_order ON collection_item(collection_slug, sort_order);

CREATE TABLE IF NOT EXISTS kaomoji_locale (
  locale TEXT NOT NULL,
  canonical_id TEXT NOT NULL DEFAULT '',
  field_key TEXT NOT NULL,
  field_value TEXT NOT NULL,
  PRIMARY KEY (locale, canonical_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_kaomoji_locale_record ON kaomoji_locale(canonical_id, locale);

CREATE TABLE IF NOT EXISTS search_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_aggregate (
  metric_key TEXT NOT NULL,
  metric_value REAL NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  PRIMARY KEY (metric_key, window_start)
);

CREATE TABLE IF NOT EXISTS production_release (
  version TEXT PRIMARY KEY NOT NULL,
  schema_version TEXT NOT NULL,
  production_version TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  relationship_count INTEGER NOT NULL,
  collection_count INTEGER NOT NULL,
  released_at TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  rollback_version TEXT,
  r2_manifest_key TEXT NOT NULL,
  d1_migration TEXT NOT NULL DEFAULT '0001_schema.sql'
);

CREATE TABLE IF NOT EXISTS source_attribution (
  canonical_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  source_record_id TEXT,
  license_status TEXT NOT NULL,
  PRIMARY KEY (canonical_id, source_id),
  FOREIGN KEY (canonical_id) REFERENCES kaomoji(canonical_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_attribution_source ON source_attribution(source_id);
