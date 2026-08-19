const fs = require("fs");
const p = "src/lib/kaomoji/processing/phase10/pipeline.ts";
let t = fs.readFileSync(p, "utf8");
t = t.replace(
  `    const record: Phase10ScoredRecord = {
      canonical_id: c.canonical_id,
      canonical_content: c.canonical_content,
      normalized_content: c.normalized_content,
      quality_score_v2: q.score,
      quality_score_v1: ed.quality_score,
      quality_version: q.score !== ed.quality_score ? "10.0.0-quality-v2" : ed.quality_version,
      quality_components: q.components,
      quality_status: q.status,
      quality_bucket: q.bucket,
      quality_reasons: q.reasons,
      beauty_score_v1: b.score,
      beauty_version: "10.0.0-aesthetic-v1",
      beauty_components: b.components,
      beauty_features: b.features,
      uniqueness_score_v1: u.score,
      uniqueness_version: "10.0.0-uniqueness-v1",
      uniqueness_components: u.components,
      expressiveness_score_v1: e.score,
      expressiveness_version: "10.0.0-expressiveness-v1",
      expressiveness_components: e.components,
      overall_score_v1: o.score,
      overall_version: "10.0.0-overall-v1",
      overall_components: o.components,
      score_confidence: scoreConf,
      popularity_score: null,
      popularity_status: "INSUFFICIENT_DATA",
      duplicate_group_id: c.duplicate_group_id,
      variant_group_id: c.variant_group_id,
      variant_type: variantInfo?.type ?? null,
      variant_confidence: variantInfo ? "MEDIUM" : null,
      publication_status: c.publication_status,
      curation_status: c.curation_status,
      is_public: ed.is_public,
      review_queues: [],
    };
    record.review_queues = buildReviewQueues(record);
    scored.push(record);`,
  `    const draft: Phase10ScoredRecord = {
      canonical_id: c.canonical_id,
      canonical_content: c.canonical_content,
      normalized_content: c.normalized_content,
      quality_score_v2: q.score,
      quality_score_v1: ed.quality_score,
      quality_version: "10.0.0-quality-v2",
      quality_components: q.components,
      quality_status: q.status,
      quality_bucket: q.bucket,
      quality_reasons: q.reasons,
      beauty_score_v1: b.score,
      beauty_version: "10.0.0-aesthetic-v1",
      beauty_components: b.components,
      beauty_features: b.features,
      uniqueness_score_v1: u.score,
      uniqueness_version: "10.0.0-uniqueness-v1",
      uniqueness_components: u.components,
      expressiveness_score_v1: e.score,
      expressiveness_version: "10.0.0-expressiveness-v1",
      expressiveness_components: e.components,
      overall_score_v1: o.score,
      overall_version: "10.0.0-overall-v1",
      overall_components: o.components,
      score_confidence: scoreConf,
      popularity_score: null,
      popularity_status: "INSUFFICIENT_DATA",
      duplicate_group_id: c.duplicate_group_id,
      variant_group_id: c.variant_group_id,
      variant_type: variantInfo?.type ?? null,
      variant_confidence: variantInfo ? "MEDIUM" : null,
      publication_status: c.publication_status,
      curation_status: c.curation_status,
      is_public: ed.is_public,
      review_queues: [],
    };
    scored.push({ ...draft, review_queues: buildReviewQueues(draft) });`,
);
t = t.replace(
  `  const variantByCanonical = new Map<string, { type: string }>();
  for (const vg of variantGroups) {
    for (const rid of vg.raw_ids) {
      const rec = canonical.find((c) => c.created_from_raw_ids.includes(rid));
      if (rec) variantByCanonical.set(rec.canonical_id, { type: vg.variant_type });
    }
  }`,
  `  const rawToCanonical = new Map<string, string>();
  for (const c of canonical) for (const rid of c.created_from_raw_ids) rawToCanonical.set(rid, c.canonical_id);
  const variantByCanonical = new Map<string, { type: string }>();
  for (const vg of variantGroups) {
    for (const rid of vg.raw_ids) {
      const cid = rawToCanonical.get(rid);
      if (cid) variantByCanonical.set(cid, { type: vg.variant_type });
    }
  }`,
);
fs.writeFileSync(p, t, "utf8");
console.log("fixed pipeline");
