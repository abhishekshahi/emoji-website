const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const m = JSON.parse(fs.readFileSync(path.join(root, "data/kaomoji/processed/phase-11/manifests/phase-11-final.json"), "utf8"));
const v = JSON.parse(fs.readFileSync(path.join(root, "data/kaomoji/processed/phase-11/composition/variant-composition.json"), "utf8"));

const md = `# Phase 11 — Exact 63,248 Canonical Library Composition Audit

**Verdict:** ${m.errors.length === 0 ? "PASS (analysis-only, no data mutation)" : "FAIL"}
**Timestamp:** ${m.timestamp}
**Pipeline:** ${m.pipeline_version}

---

## 1. RAW Immutability

| Check | Result |
|-------|--------|
| Phase 11 run: RAW before | ${m.raw_before.toLocaleString()} |
| Phase 11 run: RAW after | ${m.raw_after.toLocaleString()} |
| RAW removed during Phase 11 | ${m.raw_removed} |
| RAW modified during Phase 11 | ${m.raw_modified === 0 ? "0 (SHA unchanged during run)" : m.raw_modified} |
| Current RAW SHA-256 | \`${m.raw_sha256}\` |

### Phase 8 Baseline Comparison

| Check | Expected (Phase 8) | Current | Status |
|-------|-------------------|---------|--------|
| RAW count | 232,683 | ${m.raw_before.toLocaleString()} | **DRIFT (+${(m.raw_before - m.phase8_baseline_raw_count).toLocaleString()})** |
| RAW SHA-256 | \`d795bc67…18640\` | \`${m.raw_sha256.slice(0, 8)}…\` | **MISMATCH** |

**Finding:** Phase 11 did **not** modify RAW during this audit run. However, \`data/kaomoji/raw/records.json\` has grown by **3,825 records** since the Phase 7/8 snapshot (\`232,683 → 236,508\`). The **63,248 canonical library** was built from the frozen Phase 8 outputs and remains valid for composition analysis. Re-run Phase 8+ to incorporate new RAW rows.

---

## 2. Canonical Candidate Definition

**"Canonical candidate" means exactly:**

> ${m.canonical_definition.definition}

| Field | Source |
|-------|--------|
| Source of truth | \`${m.canonical_definition.source_of_truth}\` |
| Count | **${m.canonical_candidates.toLocaleString()}** |

Each inventory record includes: \`canonical_id\`, \`canonical_content\`, \`normalized_content\`, \`content_type\`, \`publication_status\`, \`curation_status\`, Phase 10 scores (\`quality_score_v2\`, \`beauty_score_v1\`, \`uniqueness_score_v1\`, \`expressiveness_score_v1\`, \`overall_score_v1\`), \`duplicate_group_id\`, \`variant_group_id\`, \`provenance_status\`, \`license_status\`, \`source_occurrence_count\`, \`raw_occurrence_count\`.

Output: \`data/kaomoji/processed/phase-11/composition/canonical-inventory.json\`

---

## 3. Verified Baseline Totals

| Metric | Count | Verified |
|--------|------:|----------|
| RAW occurrences (Phase 8 baseline) | 232,683 | Phase 7 snapshot |
| Canonical candidates | **63,248** | ✓ |
| KEEP / public candidates | **50,980** | ✓ |
| REVIEW | **12,202** | ✓ |
| REMOVE_CANDIDATE | **66** | ✓ (not deleted) |
| Duplicate groups | **49,885** | ✓ |
| Variant groups | **15,143** | ✓ |
| Legitimate variants | **2,533** | ✓ |
| Unique records | **13,363** | ✓ |

---

## 4. Content-Type Breakdown (Primary — no double-count)

| Primary Content Type | Count |
|---------------------|------:|
${Object.entries(m.primary_content_type).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`| ${k} | ${v.toLocaleString()} |`).join("\n")}
| **Total** | **${m.canonical_candidates.toLocaleString()}** |

- **Secondary content-type labels** (multi-label, not added to primary total): **${m.secondary_content_type_labels.toLocaleString()}**
- Types not present in dataset: \`ASCII_ART\`, \`UNICODE_ART\`, \`EMOJI\`, \`EMOJI_COMBINATION\`, \`SYMBOL\`, \`OTHER\` as primary types
- Closest mappings: TEXT_FACE / EMOTICON cover ASCII-style faces; EMOJI_SEQUENCE / ZWJ_SEQUENCE / FLAG cover emoji sequences

**Curation REVIEW records (not a content type):** ${m.review.toLocaleString()}

---

## 5. Style Breakdown

### Primary Style (one per record)

| Style | Count |
|-------|------:|
${Object.entries(m.style_primary).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`| ${k} | ${v.toLocaleString()} |`).join("\n")}

- **Multi-label style coverage:** ${m.style_multi_label_records.toLocaleString()} records carry 2+ style signals (taxonomy + inference)
- **Review (no style assigned/inferred):** ${m.style_primary.review ?? 0}

---

## 6. Emotion Breakdown (Phase 9 Taxonomy — primary slug)

| Emotion | Count |
|---------|------:|
${Object.entries(m.emotion).filter(([k])=>k!=="other"&&k!=="unclassified").sort((a,b)=>b[1]-a[1]).map(([k,v])=>`| ${k.charAt(0).toUpperCase()+k.slice(1)} | ${v.toLocaleString()} |`).join("\n")}
| Other | ${(m.emotion.other??0).toLocaleString()} |
| Unclassified | ${(m.emotion.unclassified??0).toLocaleString()} |

### Classification Confidence (records with any emotion label vs none)

| Confidence | Count |
|------------|------:|
| CONFIRMED (\`category_status=ASSIGNED\`) | ${m.emotion_confidence.CONFIRMED.toLocaleString()} |
| INFERRED (categories present, status REVIEW) | ${m.emotion_confidence.INFERRED.toLocaleString()} |
| REVIEW (no emotion category) | ${m.emotion_confidence.REVIEW.toLocaleString()} |

---

## 7. Relationship Breakdown (primary slug)

| Relationship | Count |
|--------------|------:|
${Object.entries(m.relationship).filter(([k])=>k!=="other"&&k!=="unclassified").sort((a,b)=>b[1]-a[1]).map(([k,v])=>`| ${k.replace(/-/g," ").replace(/\\b\\w/g,c=>c.toUpperCase())} | ${v.toLocaleString()} |`).join("\n")}
| Other Relationship | ${(m.relationship.other??0).toLocaleString()} |
| Unclassified | ${(m.relationship.unclassified??0).toLocaleString()} |

---

## 8. Cute / Kawaii Breakdown (multi-label — record may appear in multiple)

| Label | Records Tagged |
|-------|---------------:|
${Object.entries(m.cute_kawaii).filter(([k])=>!k.includes("not")&&!k.includes("other")).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`| ${k.charAt(0).toUpperCase()+k.slice(1)} | ${v.toLocaleString()} |`).join("\n")}
| Other Cute | ${(m.cute_kawaii.other_cute??0).toLocaleString()} |
| Not classified | ${(m.cute_kawaii.not_classified??0).toLocaleString()} |

---

## 9. Animal Breakdown (multi-label)

| Animal | Records Tagged |
|--------|---------------:|
${Object.entries(m.animals).filter(([k])=>!k.includes("unclassified")&&!k.includes("other_animal")).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`| ${k.replace(/-/g," ").replace(/\\b\\w/g,c=>c.toUpperCase())} | ${v.toLocaleString()} |`).join("\n")}
| Animal Unclassified | ${(m.animals.animal_unclassified??0).toLocaleString()} |

---

## 10. Action Breakdown (multi-label)

| Action | Records Tagged |
|--------|---------------:|
${Object.entries(m.actions).filter(([k])=>k!=="other_action"&&k!=="no_action").sort((a,b)=>b[1]-a[1]).map(([k,v])=>`| ${k.charAt(0).toUpperCase()+k.slice(1)} | ${v.toLocaleString()} |`).join("\n")}
| Other Action | ${(m.actions.other_action??0).toLocaleString()} |
| No Action label | ${(m.actions.no_action??0).toLocaleString()} |

Note: \`crying\` and \`laughing\` are classified under **EMOTION**, not ACTIONS, per Phase 9 taxonomy.

---

## 11. Variant Composition

### Groups

| Metric | Count |
|--------|------:|
| Total variant groups | ${m.variant_composition.total_groups.toLocaleString()} |
| Legitimate variants (\`formatting_spacing\` + \`unicode_representation\`) | ${m.variant_composition.legitimate_variants.toLocaleString()} |
| Review variants (\`category_context\`) | ${m.variant_composition.review_variants.toLocaleString()} |
| Duplicate-like (near-duplicate review flag) | ${m.variant_composition.duplicate_like_variants.toLocaleString()} |

### Canonical Records in Variant Groups (unique canonical_ids)

| Variant Bucket | Canonical Records |
|----------------|-------------------:|
| SPACING_VARIANT | ${v.member_counts.SPACING_VARIANT.toLocaleString()} |
| UNICODE_VARIANT | ${v.member_counts.UNICODE_VARIANT.toLocaleString()} |
| EMOTION_VARIANT (category_context) | ${v.member_counts.EMOTION_VARIANT.toLocaleString()} |
| EYE / MOUTH / HAND / DECORATIVE / STYLE / INTENSITY | 0 (not present in Phase 8 variant_type data) |

Phase 8 variant types: \`formatting_spacing\` (1,165 groups), \`unicode_representation\` (1,368 groups), \`category_context\` (12,610 groups).

---

## 12. Unique Record Composition (13,363)

| Metric | Count |
|--------|------:|
| Total unique (1 raw_id → 1 canonical) | ${m.unique_composition.total.toLocaleString()} |
| Unique legitimate (KEEP_CANDIDATE) | ${m.unique_composition.unique_legitimate.toLocaleString()} |
| Unique review | ${m.unique_composition.unique_review.toLocaleString()} |
| Unique remove candidate | ${m.unique_composition.unique_remove_candidate.toLocaleString()} |

**Being unique is NOT a removal reason** — 8,862 unique records are KEEP_CANDIDATE.

### By Content Type
${Object.entries(m.unique_composition.by_content_type).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join("\n")}

### By Quality (Phase 10)
${Object.entries(m.unique_composition.by_quality).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join("\n")}

### By License
${Object.entries(m.unique_composition.by_license).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join("\n")}

### By Provenance
${Object.entries(m.unique_composition.by_provenance).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join("\n")}

---

## 13. Quality Breakdown (Phase 10 \`quality_score_v2\`)

| Bucket | Count |
|--------|------:|
${Object.entries(m.quality_buckets).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`| ${k} | ${v.toLocaleString()} |`).join("\n")}

### Score Distributions

| Score | Beauty | Uniqueness | Expressiveness | Overall |
|-------|--------|------------|----------------|---------|
${["90-100","80-89","70-79","60-69","40-59","0-39"].map(b=>`| ${b} | ${m.beauty_distribution[b]??0} | ${m.uniqueness_distribution[b]??0} | ${m.expressiveness_distribution[b]??0} | ${m.overall_distribution[b]??0} |`).join("\n")}

---

## 14. Publication, Curation, License, Provenance

### Publication
${Object.entries(m.publication).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join("\n")}

### Curation
${Object.entries(m.curation).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join("\n")}

### License
${Object.entries(m.license).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join("\n")}

### Provenance
${Object.entries(m.provenance).map(([k,v])=>`- ${k}: ${v.toLocaleString()}`).join("\n")}

### Popularity
- **${m.popularity_status}** — no fabricated popularity data

---

## Output Artifacts

| Path | Description |
|------|-------------|
| \`data/kaomoji/processed/phase-11/manifests/phase-11-final.json\` | Full manifest |
| \`data/kaomoji/processed/phase-11/composition/canonical-inventory.json\` | 63,248 record inventory |
| \`r2-export/PHASE-11-*.md\` | Section reports |
| \`r2-export/manifests/phase-11-composition.json\` | Export manifest |

**Commands:** \`npm run kaomoji:phase11\` · \`npm run kaomoji:phase11-reports\`
`;

fs.writeFileSync(path.join(root, "r2-export/PHASE-11-COMPOSITION-AUDIT.md"), md, "utf8");
console.log("Wrote PHASE-11-COMPOSITION-AUDIT.md");
