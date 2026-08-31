# PHASE 6–14 FULL DEEP-DEPTH FORENSIC AUDIT

**Audit date:** 2026-08-31  
**Repository:** emoji-website  
**Mode:** READ / ANALYZE / VERIFY ONLY — no code changes, no deploy, no commit  
**Auditor checkout:** local `HEAD` = `040b339ee9b6a4a374d5fe4380c892a60ec0e055`  
**Remote tip:** `origin/cursor/359-kaomoji-promotion` = `787e63ccb`

---

## Executive Summary

| Question | Answer |
|----------|--------|
| Is RAW corrupted or rewritten? | **No.** Live file = **236,508** rows, SHA256 **`fcf0b804…70aaf`** — matches Phase 12/13/21 manifests. |
| Are publication / public / canonical counts consistent? | **Yes.** 63,248 − 11,910 = 51,338; Phase 13 bucket math reconciles. |
| Why do ~20 `test:kaomoji` failures appear? | **19 = stale historical test expectations** on current checkout; **1 = real code defect** (`representativeScore` TypeError). |
| Do fixes already exist? | **Yes**, on origin commits **`139ed8a`** + **`787e63c`**, which are **not** in local `HEAD`. |
| Local vs remote | Local branch is **0 ahead / 19 behind** `origin/cursor/359-kaomoji-promotion`. |
| Data loss? | **No unexplained RAW loss.** Drift +3,825 is FastEmoji additive collection (documented). |
| Final decision | **YELLOW — RECONCILIATION REQUIRED** |

---

## Git Baseline

| Item | Value |
|------|-------|
| Current branch | `cursor/359-kaomoji-promotion` |
| Local HEAD | `040b339ee` — *kaomoji: promote 359 validated records with incremental D1 import* |
| Origin tip | `787e63ccb` — *Record build verification in Phase 6-14 reconciliation report* |
| Ahead / behind | **0 / 19** (`git rev-list --left-right --count HEAD...origin/cursor/359-kaomoji-promotion`) |
| merge-base with origin tip | `040b339ee` |
| Working tree | **Dirty** — many modified/untracked files (Step 1–6 product work, build caches, audit artifacts). Not cleaned. |

### Commit relationship (critical)

```
040b339ee  ← LOCAL HEAD (ancestor)
    ↓ (+19 commits on origin, not checked out)
04e6a9c36 … Steps 7–14 product work …
139ed8ac6  ← Fix Phase 6-14 test failures (AUTHORITATIVE RAW + quality handling)
787e63ccb  ← ORIGIN TIP (reconciliation report build verification)
```

| Commit | On local HEAD? | Role |
|--------|----------------|------|
| `040b339` | Yes (= HEAD) | 359 promotion |
| `139ed8a` | **No** (`merge-base --is-ancestor` → exit 1) | Test + `normalizeQualityScore` fix |
| `787e63c` | **No** | Reconciliation report update |

**Implication:** The reconciliation that resolves the known 20 failures already exists on origin; the current working checkout still runs **pre-reconciliation** Phase 7–13 tests and **pre-fix** `representativeScore`.

---

## Authoritative Baseline

Verified from live RAW file + Phase 12/13/14 manifests + 359-promotion final.

| Metric | Authoritative value | Primary source |
|--------|--------------------:|----------------|
| RAW COUNT | **236,508** | `data/kaomoji/raw/records.json` (computed SHA + length) |
| RAW SHA256 | **`fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf`** | Same file; Phase 12/13 manifests |
| Canonical | **63,248** | Phase 8/11/12/13 manifests |
| Quality-qualified | **63,181** | Phase 13 (`canonical − low − invalid` = 63248 − 1 − 66) |
| Public | **51,338** | Phase 12/13; D1 promotion final |
| Publication blocked (license/curation) | **11,843** | Phase 13 `publication_blocked` |
| Quality blocked (LOW+INVALID) | **67** | 1 + 66 |
| Total non-public | **11,910** | 11843 + 67; 63248 − 51338 |
| Relationships (Phase 13 library JSON) | **395,833** | Phase 13 manifest |
| Relationships (D1 post-promotion) | **396,162** | `359-promotion-final.json` / D1 metadata |
| Duplicate groups | **49,885** | Phase 8/13 |
| Variant groups | **15,143** | Phase 8/13 |
| Legitimate variants | **2,533** | Phase 8/13 |
| FastEmoji drift | **+3,825** | Phase 13 `raw_drift.added_by_source.fastemoji` |
| Excellent/high/good/medium public | **3046 / 40357 / 4306 / 3629** | Phase 13 (= 51338) |
| Search benchmark | **122/122** | Phase 14 manifest |
| Search index records | **51,338** | Phase 14 manifest |

### Historical vs authoritative RAW

| Label | Count | SHA256 | Status |
|-------|------:|--------|--------|
| Phase 7/8 historical snapshot | 232,683 | `d795bc67…8640` | **HISTORICAL** — frozen in `phase-7-final.json`, `phase-8-final.json`, `raw-snapshot.json` |
| Current RAW on disk | 236,508 | `fcf0b804…70aaf` | **AUTHORITATIVE** |
| Drift | +3,825 | FastEmoji only | **EXPECTED RECOVERY / COLLECTION** — not deletion |

Phase 11 manifest explicitly records: `raw_baseline_mismatch: true`, `phase8_baseline_raw_count: 232683`, `raw_before/after: 236508`.

---

## Phase 6 Findings

| Area | Status | Evidence |
|------|--------|----------|
| Gap-closure / source recovery code | Present in `src/lib/kaomoji` collection & processing | Not re-run end-to-end in this audit |
| Dedicated `processed/phase-6/` manifest tree | **Not found** as a phase-6 folder | Gap-closure artifacts live under collection / Phase 3–5 / RAW |
| No-loss into RAW | **PASS** for current RAW | 236,508 preserved; drift documented as FastEmoji adds |
| emoticon-data semantics | Unique upstream **1,562** vs RAW per-tag **1,879** | Origin reconciliation + Phase 3B test failure on HEAD |

**P3:** Phase 3B test on HEAD still expects `emoticon-data.raw === 1562` (unique) while RAW uses tag-expanded **1879**.

---

## Phase 7 Findings

| Area | Current HEAD | Authoritative |
|------|--------------|---------------|
| `EXPECTED_RAW_BASELINE` | **232_683** (`phase7/pipeline.ts`) | Should be **236_508** |
| Live RAW | 236,508 / `fcf0b804…` | Matches |
| Historical snapshot artifacts | 232,683 / `d795bc67…` | Keep as historical docs |
| Test `baseline raw count is 232683` | **FAIL** (actual 236508) | Stale expectation |

Origin `139ed8a` introduces `AUTHORITATIVE_RAW_*`, `PHASE8_HISTORICAL_*`, `FASTEMOJI_RAW_DRIFT` and sets `EXPECTED_RAW_BASELINE = AUTHORITATIVE_RAW_COUNT`.

**Classification:** Stale constant + stale tests on HEAD (**P3**). No RAW mutation observed.

---

## Phase 8 Findings

### Defect (real) — `representativeScore`

**File:** `src/lib/kaomoji/processing/phase8/canonical-build.ts` (lines 68–73 on HEAD)

```ts
let score = meta.quality_score; // throws if meta undefined / quality_score missing → undefined + number
```

**Reproduced:** `kaomoji-phase8.test.ts` → `full pipeline maps all raw records`  
`TypeError: Cannot read properties of undefined (reading 'quality_score')`

**Cause:** Phase 8 pipeline run against **current** RAW (236,508) includes FastEmoji rows **outside** the Phase 8 historical meta map (`outside_canonical_layer: 3825` in Phase 13 drift). Missing `meta` → crash.

**Already fixed on origin `139ed8a`:** `normalizeQualityScore()` → missing/invalid → **0** (no silent promotion).

**Severity on current checkout:** **P2** (functional defect blocking Phase 8 pipeline re-run).  
**Not P0:** Does not corrupt stored RAW/canonical artifacts; crash is at runtime of pipeline tests.

### Stale SHA / count tests

Tests compare current RAW to Phase 7 snapshot SHA `d795bc67…` and count 232683 → **FAIL**. Historical snapshots remain valid **historical** documents.

---

## Phase 9 Findings

| Area | Status |
|------|--------|
| Manifest `phase-9-final.json` | `raw_before/after=236508`, SHA `fcf0b804…`; warning notes `!= 232683` |
| Tests on HEAD expecting 232683 / old SHA | **Stale (P3)** |
| Fabricated meaning / popularity | No evidence of new fabrication in this audit scope |
| RAW immutability in artifacts | Preserved |

---

## Phase 10 Findings

| Area | Status |
|------|--------|
| Manifest | RAW 236508 / SHA authoritative |
| Tests on HEAD | Stale RAW count/SHA expectations (**P3**) |
| Quality as delete-from-RAW | **Not observed** — quality gates block publication |

---

## Phase 11 Findings

| Field | Manifest value | Test on HEAD |
|-------|---------------:|--------------|
| `review` (curation REVIEW) | **12,202** | Still asserted as RAW/review baselines incorrectly in places |
| `raw_before/after` | 236,508 | Tests still expect 232,683 → **FAIL** |
| `remove_candidates` | 66 | Aligns with invalid_excluded |
| Baseline mismatch flag | `true` (documented) | Expected |

**12,202 vs 11,843:** Different metrics.

- **12,202** = Phase 11 `review` / pre-359 curation REVIEW count  
- **11,843** = Phase 13 `publication_blocked` **after** 359 promotions (12202 − 359 = 11843)

Arithmetic: 11843 + 67 quality-blocked = **11910**; 63248 − 11910 = **51338**. ✓

---

## Phase 12 Findings

| Area | Status |
|------|--------|
| `public-quality/manifest.json` | Authoritative public tiers + RAW SHA match live file |
| Publication eligible | 51,338 |
| Blocked | 11,843 |
| Storage / R2 keys | Referenced in Phase 13 storage audit list — files present for major artifacts |
| Deploy | **Not performed** (audit rule) |

---

## Phase 13 Reconciliation

Phase 13 manifest is **internally consistent** with live RAW and Phase 12 public-quality.

| Bucket | Stale test (HEAD) | Manifest | Δ |
|--------|------------------:|---------:|--:|
| excellent_public | 3,017 | **3,046** | +29 |
| high_public | 40,041 | **40,357** | +316 |
| good_public | 4,294 | **4,306** | +12 |
| medium_public | 3,627 | **3,629** | +2 |
| Sum | 51,979? (stale) | **51,338** | matches public |
| publication_blocked | 12,202 | **11,843** | −359 (promotions) |

**Root cause of stale tiers:** 359 curated promotions shifted public-tier distribution; tests not updated on local HEAD (fixed on `139ed8a`).

**Relationships:** Phase 13 JSON **395,833**; D1 after insert-only promotion edges **396,162**. Documented in `359-promotion-final.json` (`library_relationships` vs `d1_relationships`). **Not a loss** — D1 has additional hub edges; library JSON is the Phase 13 analytical baseline.

---

## Phase 14 Search Findings

| Metric | Value | Source |
|--------|------:|--------|
| Index records | 51,338 | Phase 14 manifest |
| Benchmark | **122/122** | Phase 14 manifest (`benchmark_pass_rate: 1`) |
| Zero-result rate | 0 | Manifest |
| Artifacts present | `search-index-v2.json` exists | Filesystem check |

Local `kaomoji-phase14.test.ts` was started during audit; Phase 14 **manifest** already records full benchmark pass. No evidence of fabricated search hits from this audit. Search code on dirty working tree may differ from `040b339` tip — treat product Step overlays as **out of Phase 6–14 core** unless they touch index generation.

---

## Cross-Phase Conservation

```
Phase 6/collection → RAW 236,508 (auth)
        ↓ (no delete)
Phase 7 historical run @ 232,683 snapshot (HISTORICAL)
        ↓
Phase 8 canonical 63,248 (built on historical RAW; FastEmoji +3825 outside map)
        ↓
Phase 9–11 analysis @ current RAW 236,508 (manifests updated; tests stale on HEAD)
        ↓
Phase 12 public 51,338 / blocked 11,843
        ↓
Phase 13 reconciliation (authoritative counts)
        ↓
Phase 14 search index 51,338 / 122/122
```

| Transition | Delta | Classification |
|------------|------:|----------------|
| Historical RAW → current RAW | +3,825 | **RECOVERY / NEW SOURCE** (FastEmoji) |
| RAW → canonical | 236508 → 63248 | **MERGE** (exact dup collapse) + variants preserved |
| Canonical → public | 63248 → 51338 | **BLOCK / REVIEW / FILTER** |
| review 12202 → blocked 11843 | −359 | **EXPECTED TRANSFORMATION** (359 promotion) |
| relationships 395833 → D1 396162 | +329 | **EXPECTED** insert-only enrichment (documented) |
| Unexplained RAW loss | 0 | — |

**UNKNOWN DELTA count:** **0** for RAW/public/canonical identity after accounting for documented metrics.

---

## Provenance Audit

| Sample class | Trace status |
|--------------|--------------|
| Exact duplicates | Merged to one `canonical_id`; `source_occurrences` / `created_from_raw_ids` preserved in Phase 8 design |
| FastEmoji drift (+3825) | In RAW; **outside** Phase 8 canonical map (`in_phase8_canonical: false` samples) — provenance for these is RAW-only until a re-canonicalization pass |
| Blocked / review | Present as non-public; not deleted from RAW |
| Public | In Phase 12/14 indexes |

**P2 note:** FastEmoji drift records are **not lost**, but are **not fully folded into Phase 8 canonical library**. That is a layer-coverage gap, not RAW deletion. Re-running Phase 8 without `normalizeQualityScore` currently **crashes** (see above).

---

## Determinism Audit

| Check | Result |
|-------|--------|
| Live RAW SHA vs Phase 12/13 | **Match** |
| Re-run full Phase 7–8 pipelines twice | **Not completed** — Phase 8 crashes on HEAD; origin fix not checked out |
| Phase 14 index hash dual-run | Not re-generated in this audit |

---

## Security Audit (static / controlled)

| Area | Finding |
|------|---------|
| RAW rewrite / destructive git | **Not performed**; audit rules respected |
| XSS / SQL in Phase 6–14 generators | No new exploit testing; existing sanitize patterns in product layers outside core |
| Secrets in Phase 6–14 manifests | No secrets observed in sampled manifests |
| P0/P1 security defect in Phase 6–14 core | **None identified** in this pass |

---

## Performance Audit

| Area | Note |
|------|------|
| Full `test:kaomoji` | Heavy (prior runs ~7+ minutes); known ~20 fails on HEAD |
| Phase 8 full pipeline | **Fails fast** with TypeError on missing quality meta |
| Unnecessary full RAW scans | Pipeline design still loads full RAW — expected for these phases |

No unrelated optimization recommended.

---

## Test Reconciliation

### Groups

| Group | Meaning | Count (known set) |
|-------|---------|------------------:|
| **A** | Stale historical expectations | ~19 |
| **C** | Genuine implementation defect | **1** (`representativeScore`) |
| **B** | Missing artifact | 0 (for these failures) |
| **D** | Data integrity / corruption | 0 |
| **E** | Generated artifact vs test | Tests vs Phase 13/RAW (authoritative artifacts win) |

### Master table (failed / mismatched expectations)

| Phase | Area | Expected (HEAD test) | Actual | Source | Status | Severity | Root Cause | Action |
|------|------|---------------------:|-------:|--------|--------|----------|------------|--------|
| 3B | emoticon-data raw | 1562 | 1879 | RAW / tag expansion | FAIL | P3 | Unique vs per-tag occurrence | Align test to 1879 **or** assert both semantics; already on `139ed8a` |
| 7 | RAW baseline | 232683 | 236508 | Live RAW + Phase 13 | FAIL | P3 | Stale `EXPECTED_RAW_BASELINE` | Use AUTHORITATIVE_RAW_COUNT (`139ed8a`) |
| 8 | RAW SHA | d795bc67… | fcf0b804… | Live RAW | FAIL | P3 | Compared to historical snapshot | Assert AUTHORITATIVE_RAW_SHA256; keep historical labeled |
| 8 | RAW count | 232683 | 236508 | Live RAW | FAIL | P3 | Stale baseline | Same as Phase 7 |
| 8 | full pipeline | pass | TypeError quality_score | canonical-build.ts:73 | FAIL | **P2** | Missing meta for drift RAW | Apply `normalizeQualityScore` (`139ed8a`) |
| 8 | provenance / coverage denom | 232683 | 236508 | — | FAIL | P3 | Stale denominator | Update baseline constant |
| 9 | RAW count/SHA | historical | authoritative | Phase 9 manifest already 236508 | FAIL | P3 | Stale tests | Update tests (`139ed8a`) |
| 10 | RAW count/SHA | historical | authoritative | Phase 10 manifest | FAIL | P3 | Stale tests | Update tests |
| 11 | RAW count/SHA | historical | authoritative | Phase 11 manifest | FAIL | P3 | Stale tests | Update tests |
| 11 | analysis raw length | 232683 | 236508 | Live RAW | FAIL | P3 | Hardcoded stale | Update |
| 13 | excellent_public | 3017 | 3046 | Phase 13 manifest | FAIL | P3 | Pre-359 public tiers | Update to 3046 |
| 13 | high_public | 40041 | 40357 | Phase 13 | FAIL | P3 | Pre-359 | Update to 40357 |
| 13 | good_public | 4294 | 4306 | Phase 13 | FAIL | P3 | Pre-359 | Update to 4306 |
| 13 | medium_public | 3627 | 3629 | Phase 13 | FAIL | P3 | Pre-359 | Update to 3629 |
| 13 | publication_blocked | 12202 | 11843 | Phase 13 | FAIL | P3 | Wrong metric (review vs blocked) | Assert 11843 |
| — | relationships docs | 396162 vs 395833 | both real | 359-promotion vs Phase 13 | DOC | P3 | Two layers | Document dual baseline; do not force equality |

**Reproduced in this audit:** Phase 3B, 7, 8 (SHA, count, TypeError), Phase 13 publication_blocked — confirmed failing on current checkout.

---

## Artifact Consistency

| Artifact | Class |
|----------|-------|
| `data/kaomoji/raw/records.json` | **AUTHORITATIVE CURRENT** |
| `phase-7-final.json` / `raw-snapshot.json` @ 232683 | **HISTORICAL** |
| `phase-8-final.json` @ 232683 | **HISTORICAL** (canonical library still used) |
| `phase-9/10/11/12/13/14` manifests @ 236508 | **CURRENT** (counts) |
| Phase 8 canonical library | **CURRENT library**, built from historical RAW; FastEmoji +3825 not fully mapped |
| Origin reconciliation MD/JSON | **CURRENT fix documentation** (not in local tree until fetch/merge) |
| Local dirty Step 1–6 UI/API files | **DERIVED / PRODUCT** — outside Phase 6–14 core pipeline |

---

## No-Loss Verification

| Claim | Verdict |
|-------|---------|
| RAW rows deleted to satisfy tests | **False** — not observed |
| Exact duplicates may merge | **True** — 236508 → 63248 |
| Low quality / review may be non-public | **True** — 11910 blocked |
| Every RAW row must be public | **False requirement** — correctly not enforced |
| FastEmoji rows “missing” from canonical | **Present in RAW**; not in Phase 8 map — **coverage gap**, not deletion |

---

## Historical vs Authoritative Values

| Value | Role |
|------:|------|
| 232,683 / d795bc67… | Historical Phase 7/8 freeze |
| 236,508 / fcf0b804… | Authoritative current RAW |
| 1,562 | Upstream unique emoticon-data |
| 1,879 | RAW per-tag occurrences |
| 12,202 | Phase 11 curation REVIEW |
| 11,843 | Phase 13 publication_blocked |
| 3,017… / 40,041… | Pre-359 public tier tests |
| 3,046… / 40,357… | Post-359 Phase 13 public tiers |
| 395,833 | Phase 13 relationship JSON |
| 396,162 | D1 relationship count post-promotion |

---

## Findings by Severity

| Sev | Count | Items |
|-----|------:|-------|
| **P0** | 0 | — |
| **P1** | 0 | — |
| **P2** | 1 | `representativeScore` TypeError on missing quality meta (HEAD only; fixed on origin) |
| **P3** | ~19+ | Stale tests/constants; dual relationship baseline documentation; Phase 8 coverage of FastEmoji drift |
| **P4** | n/a | Cosmetic only |

---

## Required Fixes (report only — **do not apply without approval**)

1. **Integrate origin reconciliation** (preferred): merge/rebase or cherry-pick `139ed8a` (+ `787e63c` docs) onto current work — **or** check out those commits onto a clean tree, then re-apply Step 1–6 product commits.  
   - Updates Phase 7 AUTHORITATIVE constants  
   - Adds `normalizeQualityScore`  
   - Aligns Phase 3B/7/8/9/10/11/13 tests  

2. **If re-implementing instead of cherry-pick** (exact symbols):  
   - `src/lib/kaomoji/processing/phase8/canonical-build.ts` — `normalizeQualityScore` + use in `representativeScore`  
   - `src/lib/kaomoji/processing/phase7/pipeline.ts` — AUTHORITATIVE vs PHASE8_HISTORICAL constants  
   - Test files listed in origin reconciliation report  

3. **Do not** change RAW, reduce counts, or rewrite historical Phase 7/8 manifests.

---

## Already-Fixed Items

On **`origin/cursor/359-kaomoji-promotion`** (`139ed8a`, documented in `r2-export/PHASE-6-14-TEST-FAILURE-RECONCILIATION.md` on that tip):

- All Group A stale expectations  
- Group C `representativeScore` null-safety  
- Explicit historical vs authoritative RAW constants  

**Not present in local HEAD `040b339`.**

---

## Remaining Defects (on current checkout)

1. P2 `representativeScore` crash  
2. Stale Phase 3B/7/8/9/10/11/13 tests  
3. FastEmoji +3825 not in Phase 8 canonical map (coverage; needs safe re-pipeline **after** fix)  
4. Dirty working tree may complicate merge — preserve user work; no hard reset  

---

## Missing Artifacts

| Item | Notes |
|------|-------|
| Local copy of origin reconciliation MD/JSON | Exists on origin tip; not in `040b339` tree |
| Dedicated `processed/phase-6/` folder | Not present; not necessarily a defect if Phase 6 outputs feed RAW |

---

## Environment Limitations

- Full `npm run test:kaomoji` / `build` / `build:cf` not fully re-run in this session (time); **targeted** failing tests **were** reproduced.  
- Did not check out `139ed8a` (would alter tree / risk user work).  
- Did not deploy.  
- Phase 14 unit test process was still running at report write; manifest already asserts 122/122.

---

## Final Go/No-Go Assessment

### YELLOW — RECONCILIATION REQUIRED

**Why not GREEN:** Local HEAD still has P2 quality-score crash and stale tests; origin fixes not applied to this checkout.

**Why not RED:** No P0/P1 data corruption; RAW immutable and verified; public/canonical/blocked arithmetic closes; Phase 13/14 manifests coherent; known failures classified with authoritative sources; reconciliation already authored on origin.

**Next approved action (when user authorizes):** bring `139ed8a`/`787e63c` into the working branch safely, re-run `npm run typecheck` + `npm run test:kaomoji`, then optionally re-run Phase 8 with null-safe scoring — **without** modifying RAW.

---

*End of forensic audit. No source files were modified for remediation.*
