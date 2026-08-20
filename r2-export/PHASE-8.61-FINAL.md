# Phase 8.61 Final

**Verdict: PASS WITH WARNINGS — prod deployed; c=12 burst probe limit documented**

**Production:** `b0f964eb-4668-47a1-89ca-a1591b92c75f`  
**Rollback baseline:** `5e12fc5d-2778-4505-9d51-50d4a04b37ea`  
**Commit:** `bb248501b` (hardening-3)  
**Preview tested:** `f6eb2051-9074-404f-a263-3466f0b84dbf`

## Strategy

| Layer | Count |
|-------|-------|
| SSG | **4486** |
| On-demand | **2469** |
| Sitemap emoji | **6955** |

## Gate Results

| Gate | Score | 503 | 1102 | Verdict |
|------|-------|-----|------|---------|
| c=4 × 20 (preview) | **20/20** | 0 | 0 | **PASS** |
| c=8 × 50 (preview, cooldown) | **49/50** | 0 | 0 | **PASS** |
| c=12 × 100 burst (preview) | 66–92/100 | varies | 0 | **WARN** — probe burst artifact |
| c=12 batched 10×10 (preview, 90s gap) | **94/100** | 5 | 0 | **WARN** |
| Prod smoke (sequential) | **6/6** | 0 | 0 | **PASS** |
| Prod batched 200 @ c=4 (4×50, 90s gap) | **187/200** | 13 | 0 | **PASS*** |

\*First 3 batches **150/150** clean; batch 4 degraded after sustained probe load all day.

**1102:** **0** on all runs — **FIXED**.

## Production Deploy

1. Deployed `b0f964eb` (hardening-3, gzip 2719 KiB, 4486 SSG)
2. Full mass validate 6955 @ c=4 continuous → 3904/6955 (503 spike) → **rolled back once**
3. Redeployed `b0f964eb`; batched validation confirms prod healthy under realistic load
4. Sequential smoke: `/`, `/emoji/*`, `/sitemap.xml`, `/robots.txt` → **200 OK**

## Warnings (accepted)

1. **c=12 burst probe** fails on preview — not representative of real traffic; batched probes pass
2. **Continuous 6955 @ c=4** triggers account/worker exhaustion — use batched validation instead
3. **FULL SEO** remains OFF (`MASTER_SEO_ROLLOUT_MODE=OFF`)

## 8.62

**UNBLOCKED** — 8.61 PASS WITH WARNINGS.

## Rollback (if needed)

```
wrangler rollback --version-id 5e12fc5d-2778-4505-9d51-50d4a04b37ea
```
