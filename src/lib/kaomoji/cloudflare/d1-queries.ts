/** Runtime D1 query strings — no binding required in unit tests. */

export const D1_GET_KAOMOJI_BY_SLUG = `
  SELECT canonical_id, slug, content, normalized_content, editorial_name, accessible_name,
         seo_title, seo_description, quality_score, quality_bucket, beauty_score,
         editorial_tier, editorial_priority, meaning, common_usage, duplicate_group_id, variant_group_id
  FROM kaomoji
  WHERE slug = ?1 AND is_public = 1
  LIMIT 1
`.trim();

export const D1_GET_KAOMOJI_BY_CANONICAL_ID = `
  SELECT canonical_id, slug, content, normalized_content, editorial_name, accessible_name,
         seo_title, seo_description, quality_score, quality_bucket, beauty_score
  FROM kaomoji
  WHERE canonical_id = ?1 AND is_public = 1
  LIMIT 1
`.trim();

export const D1_GET_RELATED_KAOMOJI = `
  SELECT r.relationship_type, r.confidence, r.score,
         k.canonical_id, k.slug, k.content, k.accessible_name, k.quality_score
  FROM relationship r
  JOIN kaomoji k ON k.canonical_id = r.to_canonical_id
  WHERE r.from_canonical_id = ?1 AND k.is_public = 1
  ORDER BY r.score DESC, k.quality_score DESC
  LIMIT ?2
`.trim();

export const D1_GET_COLLECTION = `
  SELECT slug, title, description, rule, item_count
  FROM collection
  WHERE slug = ?1
  LIMIT 1
`.trim();

export const D1_GET_COLLECTION_ITEMS = `
  SELECT ci.sort_order, k.canonical_id, k.slug, k.content, k.accessible_name, k.quality_score
  FROM collection_item ci
  JOIN kaomoji k ON k.canonical_id = ci.canonical_id
  WHERE ci.collection_slug = ?1 AND k.is_public = 1
  ORDER BY ci.sort_order ASC
  LIMIT ?2
`.trim();

export const D1_GET_SEARCH_METADATA = `
  SELECT key, value, updated_at
  FROM search_metadata
  WHERE key = ?1
  LIMIT 1
`.trim();

export const D1_LIST_SEARCH_METADATA = `
  SELECT key, value, updated_at
  FROM search_metadata
  ORDER BY key ASC
`.trim();

export const D1_GET_PRODUCTION_RELEASE = `
  SELECT version, schema_version, production_version, record_count, relationship_count,
         collection_count, released_at, checksum_sha256, rollback_version, r2_manifest_key
  FROM production_release
  WHERE version = ?1
  LIMIT 1
`.trim();

export const D1_GET_LATEST_PRODUCTION_RELEASE = `
  SELECT version, schema_version, production_version, record_count, relationship_count,
         collection_count, released_at, checksum_sha256, rollback_version, r2_manifest_key
  FROM production_release
  ORDER BY released_at DESC
  LIMIT 1
`.trim();

export const D1_GET_KAOMOJI_LOCALE_FIELDS = `
  SELECT field_key, field_value
  FROM kaomoji_locale
  WHERE locale = ?1 AND canonical_id = ?2
`.trim();

export const D1_COUNT_PUBLIC_KAOMOJI = `
  SELECT COUNT(*) AS count FROM kaomoji WHERE is_public = 1
`.trim();
