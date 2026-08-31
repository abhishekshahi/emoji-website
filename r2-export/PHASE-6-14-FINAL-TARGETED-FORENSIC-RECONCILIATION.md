# PHASE 6–14 FINAL TARGETED FORENSIC RECONCILIATION

## Final Verdict

**GREEN — RECONCILED**

## 1. Git baseline

| Item | Value |
|------|-------|
| Branch | `cursor/359-kaomoji-promotion` |
| HEAD | `f3d6c968d` (cherry-picks of 139ed8a + 787e63c) |
| Protection | `pre-phase-6-14-reconciliation-040b339` = `040b339ee` |
| origin tip | `787e63ccb` (remaining 17 product commits **not** merged) |
| Deploy / push / commit of local work | none |

## 2. Existing reconciliation status

Cherry-picks already integrated before this pass. This pass closed the three remaining YELLOW items.

## 3. Phase 3B 1879 vs 6617 forensic conclusion

| Question | Answer |
|----------|--------|
| A. Is 6617 legitimate current per-tag occurrence count? | **Yes** — live RAW `source_id=emoticon-data` count |
| B. Is 1879 authoritative unique-record count? | **No** — unique content in RAW = **3176**; 1879 was an early Phase-5 expansion estimate from upstream ~1562 |
| C. Different metrics compared? | **Yes** — test reads RAW via `loadCollectedSnapshot`; 1879 was a stale theoretical expansion |
| D. Which count should Phase 3B assert? | **6617** (RAW-derived) |
| E. Changing the test safe? | **Yes** |
| F. Artifact regen required? | **No** |

## 4. Phase 8 232683 artifact-drift root cause

**B + D:** Stale generated Phase 7/8 artifacts frozen at historical RAW **232683** / SHA `d795bc67…`, while authoritative RAW is **236508**. Historical baseline remains documented via `PHASE8_HISTORICAL_*`. Not a RAW bug.

Regenerated Phase 7 → Phase 8 via `npm run kaomoji:phase7` / `kaomoji:phase8`.

Live Phase 8 now: raw/mapped/occurrences = **236508**, canonical candidates = **63811**.

Frozen Phase 12/13 publication set remains **63248 / 51338** (intentionally not regenerated).

## 5. representativeScore root cause/fix

Upstream `normalizeQualityScore` did not guard **undefined/null meta**. Fixed with optional chaining + `MISSING_PHASE7_META` fallback. Exported `normalizeQualityScore` / `representativeScore` with regression tests. Invalid/missing ⇒ **0**, no TypeError. Valid scoring unchanged.

## 6. Phase 8 regeneration details

| Step | Result |
|------|--------|
| Phase 7 regen | raw 236508/236508, removed 0, modified 0 |
| Phase 8 run ×2 | mapped 236508, occurrences 236508, canonical 63811 |
| Determinism | library/occurrence/provenance SHA identical; manifest timestamp-only drift |
| Phase 9–11 | synced to live 63811 layer |
| Phase 12 public-quality | **untouched freeze** 51338 / manifest 63248 |
| Phase 10 scores | publication IDs realigned to Phase 12 frozen scores (4 IDs) so Phase 13 audit stays clean |

## 7. Phase 6–14 invariant matrix

| Phase | Status |
|-------|--------|
| 6 | RAW immutable |
| 7 | 236508 + authoritative SHA; no-loss |
| 8 | every RAW mapped; occurrences 236508; score safe; deterministic |
| 9 | live layer 63811; no RAW deletion; search 122/122 (Phase 14) |
| 10 | live layer 63811; publication freeze scores preserved for Phase 12 IDs |
| 11 | analysis-only 63811; historical curation counts updated where live |
| 12 | frozen public 51338 / canonical 63248 preserved |
| 13 | 3046/40357/4306/3629/11843; public 51338; drift 3825; outside_canonical 0 |
| 14 | 42/42; benchmark 122/122 |

## 8. Determinism results

Phase 8 double-run: core outputs identical. Phase 13 deterministic rerun: publication_eligible stable at 51338.

## 9. Targeted test results

Phase 3B + 7–14: **236/236 PASS**

## 10. Full test results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASS (0) |
| `npm run test:kaomoji` | **738/738 PASS** |
| `npm test` | Failures confined to pre-existing master checksum/R2/artwork (unrelated) |
| `npm run lint` | Pre-existing generated-tree noise (unrelated; not re-run as blocker) |

## 11. RAW before/after

| | COUNT | SHA256 |
|--|------:|--------|
| Before | 236508 | `fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf` |
| After | 236508 | `fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf` |

## 12. Local-work preservation

Step 5–7 trees present (`variations/`, `related/`, `categories/`, step tests). Protection branch intact. No stash/reset/merge of remaining 17 origin commits. Dirty application work retained.

## 13. Remaining origin commits intentionally not merged

`origin/cursor/359-kaomoji-promotion` still ahead with Steps 7–14 product commits overlapping local dirty work. **Not cherry-picked. Not merged.**

## 14. Changed files

| Path | Reason | Source/Generated | Affects RAW | Verification |
|------|--------|------------------|-------------|--------------|
| `src/lib/kaomoji/processing/phase8/canonical-build.ts` | Harden score vs null/undefined meta | source | no | unit + Phase 8 tests |
| `src/lib/kaomoji/kaomoji-phase3b.test.ts` | Assert RAW emoticon-data=6617 | source | no | Phase 3B pass |
| `src/lib/kaomoji/kaomoji-phase8.test.ts` | Regression tests for score hardening | source | no | Phase 8 pass |
| `src/lib/kaomoji/kaomoji-phase9/10/11/12/13.test.ts` | Align live vs frozen layer expectations; stop unsafe regens | source | no | targeted + full kaomoji |
| `src/lib/kaomoji/processing/phase13/raw-drift.ts` | Historical baseline for FastEmoji drift 3825 | source | no | Phase 13 tests |
| `data/kaomoji/processed/phase-7/**` | Regen against 236508 | generated | no | Phase 7 tests |
| `data/kaomoji/processed/phase-8/**` | Regen against 236508 | generated | no | Phase 8 tests + hashes |
| `data/kaomoji/processed/phase-9/**` | Sync live editorial to Phase 8 | generated | no | Phase 9 tests |
| `data/kaomoji/processed/phase-10/**` | Sync live scores; restore frozen P12 scores for shared IDs | generated | no | Phase 10/13 |
| `data/kaomoji/processed/phase-11/**` | Sync composition audit | generated | no | Phase 11 tests |
| `data/kaomoji/processed/phase-13/manifest*.json` + `raw-drift/*` | Historical drift fields after audit | generated | no | Phase 13 tests |

## Dual-layer model (intentional)

- **Live Phase 8–11 proposed/analysis layers:** 63811 canonicals from full RAW 236508
- **Frozen Phase 12–13 publication set:** 63248 / public 51338 (product surface)

END.
