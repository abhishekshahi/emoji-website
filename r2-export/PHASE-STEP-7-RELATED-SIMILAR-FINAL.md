# Step 7 — Kaomoji Related / Similar Kaomoji

**Status:** Implementation **COMPLETE** — production deploy and second live audit **PENDING** (`CLOUDFLARE_API_TOKEN` required)

## Summary

Step 7 adds a deterministic related/similar kaomoji engine using the existing **396,162** precomputed `relationship` rows in D1 — no relationship data was modified.

### UX

- **Similar Kaomoji** — `variant`, `similar_expression` (closest structural/style match)
- **Related Kaomoji** — `same_category`, `alternative`, `opposite_emotion`, etc.
- Optional **reason chip** on cards (e.g. “Happy”, “Similar expression”) — not raw scores
- **Generator:** when an exact public library match exists, fetches `/api/kaomoji/related` instead of generic search

### API

`GET|POST /api/kaomoji/related`

| Param | Description |
|-------|-------------|
| `canonical_id` | `kao_` + 16 hex |
| `slug` | Public kaomoji slug |
| `similar_limit` | Default 8, max 24 |
| `related_limit` | Default 12, max 24 |

Bounded D1 queries only — **never loads 51,338 public records into Worker memory**.

## Top-20 Research (condensed)

Studied: Kaomoji.jp, JapaneseEmoticons.me, Emojipedia related groups, Unicode variant UX, Netflix/Spotify-style “more like this”, copy-library patterns, EmojiQuick Steps 1–6, phase-19 relationship audit.

**Adopted:** precomputed edges + live public filter, similar vs related split, reason labels, internal links on detail pages, bounded API, self/dedupe guards.

**Not duplicated:** competitor lists, new relationship tables, full-library in-memory ranking.

## Algorithm

1. Fetch up to **48** precomputed edges for source (`D1_GET_RELATED_KAOMOJI`) with `is_public = 1`, self excluded in SQL
2. Rank by `score`, `confidence`, `quality_score`
3. Partition into **Similar** vs **Related** by `relationship_type`
4. Dedupe by canonical ID, slug, normalized content
5. If &lt; 4 results: **category peer fallback** (`D1_GET_SAME_CATEGORY_PEERS`, max 24)

## Data Integrity (unchanged)

| Metric | Count |
|--------|------:|
| Canonical | 63,248 |
| Public | 51,338 |
| Blocked | 11,910 |
| RAW | 236,508 |
| Relationships | 396,162 |

**Delta:** inserted 0 · deleted 0

## Regression (local)

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS |
| Step 7 tests | 11/11 |
| `npm run build` | PASS (via build:cf pipeline) |
| `npm run build:cf` | PASS |
| `npm run deploy` | **BLOCKED** — no `CLOUDFLARE_API_TOKEN` |

## Deployment

| Field | Value |
|-------|-------|
| Git SHA (local) | `040b339ee9b6a4a374d5fe4380c892a60ec0e055` |
| Local BUILD_ID | `1dJYVl-BnSARxRaHq-TEc` |
| Production BUILD_ID (pre-deploy) | `jBTM3zuDHiOQZYEJ23nV8` |

After deploy, verify: `curl https://emojiquick.com/BUILD_ID`

## Live Audit

**First audit (pre-deploy):** `/api/kaomoji/related` → **404** on current production. Detail pages still show legacy related section from basic relationship query.

**Second audit:** Run after deploy:

```bash
npx tsx scripts/kaomoji/step7-deep-live-audit.ts
```

Run twice independently; require 0 CRITICAL/HIGH/MEDIUM, 0 self-recs, 0 blocked leaks.

---

**STEP 7 — NOT FINAL VERIFIED** until deploy + second live audit pass.
