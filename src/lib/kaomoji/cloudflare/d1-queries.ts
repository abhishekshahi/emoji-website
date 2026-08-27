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
         k.canonical_id, k.slug, k.content, k.normalized_content,
         k.accessible_name, k.editorial_name, k.quality_score,
         c.label AS category_label
  FROM relationship r
  JOIN kaomoji k ON k.canonical_id = r.to_canonical_id
  LEFT JOIN kaomoji_category kc ON kc.canonical_id = k.canonical_id AND kc.is_primary = 1
  LEFT JOIN category c ON c.slug = kc.category_slug
  WHERE r.from_canonical_id = ?1 AND k.is_public = 1 AND r.to_canonical_id != ?1
  ORDER BY r.score DESC, k.quality_score DESC
  LIMIT ?2
`.trim();

/** Bounded same-category peers when precomputed relationships are sparse. */
export const D1_GET_SAME_CATEGORY_PEERS = `
  SELECT k.canonical_id, k.slug, k.content, k.normalized_content,
         k.accessible_name, k.editorial_name, k.quality_score,
         c.label AS category_label
  FROM kaomoji_category kc_src
  INNER JOIN kaomoji_category kc ON kc.category_slug = kc_src.category_slug
    AND kc.canonical_id != kc_src.canonical_id
  INNER JOIN kaomoji k ON k.canonical_id = kc.canonical_id
  LEFT JOIN category c ON c.slug = kc.category_slug
  WHERE kc_src.canonical_id = ?1 AND kc_src.is_primary = 1
    AND k.is_public = 1 AND k.canonical_id != ?1
  ORDER BY k.quality_score DESC, k.slug ASC
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

export const D1_SEARCH_BY_KEYWORD = `
  SELECT k.canonical_id, k.slug, k.content, k.normalized_content, k.editorial_name,
         k.accessible_name, k.quality_score, k.beauty_score, k.editorial_priority, k.meaning
  FROM kaomoji k
  WHERE k.is_public = 1
    AND (
      k.canonical_id IN (SELECT canonical_id FROM kaomoji_keyword WHERE keyword = ?1)
      OR k.canonical_id IN (SELECT canonical_id FROM kaomoji_category WHERE category_slug = ?1)
      OR LOWER(COALESCE(k.editorial_name, '')) LIKE ?2
    )
  ORDER BY k.quality_score DESC, k.beauty_score DESC
  LIMIT ?3
`.trim();

/** Indexed keyword-only lookup — avoids full-table LIKE scans on Worker. */
export const D1_SEARCH_BY_KEYWORD_FAST = `
  SELECT k.canonical_id, k.slug, k.content, k.normalized_content, k.editorial_name,
         k.accessible_name, k.quality_score, k.beauty_score, k.editorial_priority, k.meaning
  FROM kaomoji_keyword kk
  INNER JOIN kaomoji k ON k.canonical_id = kk.canonical_id
  WHERE k.is_public = 1 AND kk.keyword = ?1
  ORDER BY k.quality_score DESC, k.beauty_score DESC
  LIMIT ?2
`.trim();

/** Indexed category lookup for taxonomy/synonym tokens. */
export const D1_SEARCH_BY_CATEGORY_FAST = `
  SELECT k.canonical_id, k.slug, k.content, k.normalized_content, k.editorial_name,
         k.accessible_name, k.quality_score, k.beauty_score, k.editorial_priority, k.meaning
  FROM kaomoji_category kc
  INNER JOIN kaomoji k ON k.canonical_id = kc.canonical_id
  WHERE k.is_public = 1 AND kc.category_slug = ?1
  ORDER BY k.quality_score DESC, k.beauty_score DESC
  LIMIT ?2
`.trim();

export const D1_LIST_EDITORIAL_FEATURED = `
  SELECT canonical_id, slug, content, editorial_name, accessible_name, quality_score
  FROM kaomoji
  WHERE is_public = 1 AND editorial_priority IN ('P0', 'P1')
  ORDER BY quality_score DESC, slug ASC
  LIMIT ?1
`.trim();

export const D1_GET_KAOMOJI_PUBLIC_BY_ID = `
  SELECT canonical_id, slug, content, editorial_name, accessible_name, quality_score
  FROM kaomoji
  WHERE canonical_id = ?1 AND is_public = 1
  LIMIT 1
`.trim();

export const D1_LIST_BY_CATEGORY_RANKED = `
  SELECT k.canonical_id, k.slug, k.content, k.editorial_name, k.accessible_name, k.quality_score
  FROM kaomoji_category kc
  INNER JOIN kaomoji k ON k.canonical_id = kc.canonical_id
  WHERE k.is_public = 1 AND kc.category_slug = ?1
  ORDER BY k.quality_score DESC, k.slug ASC
  LIMIT ?2
`.trim();

export const D1_SEARCH_BY_CONTENT = `
  SELECT k.canonical_id, k.slug, k.content, k.normalized_content, k.editorial_name,
         k.accessible_name, k.quality_score, k.beauty_score, k.editorial_priority, k.meaning
  FROM kaomoji k
  WHERE k.is_public = 1
    AND (k.content LIKE ?1 OR k.normalized_content LIKE ?1)
  ORDER BY k.quality_score DESC, k.beauty_score DESC
  LIMIT ?2
`.trim();
