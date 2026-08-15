# Phase 8.61 Final

**Verdict: FAIL — c=4/c=8 PASS (with cooldown); c=12 FAIL (503); prod not deployed**

**Production (unchanged):** `5e12fc5d-2778-4505-9d51-50d4a04b37ea`  
**Hardening-3 preview:** `f6eb2051-9074-404f-a263-3466f0b84dbf` @ `emoji-website-preview.emoji-website.workers.dev`  
**Prior preview:** `40ddf885` (hardening-2, commit `4d96c7e4e`)

## Strategy

| Layer | Count |
|-------|-------|
| SSG | **4486** |
| On-demand | **2469** |
| Sitemap emoji | **6955** |

## Gate Results (preview `f6eb2051` — hardening-3)

| Gate | Score | 503 | 1102 | Verdict |
|------|-------|-----|------|---------|
| c=4 × 20 | **20/20** | 0 | 0 | **PASS** |
| c=8 × 50 (1st) | 41/50 | 9 | 0 | FAIL |
| c=8 × 50 (90s retry) | **49/50** | 0 | 0 | **PASS*** |
| c=12 × 100 (best) | **92/100** | 8 | 0 | FAIL |
| c=12 × 100 (isolated) | 84/100 | 16 | 0 | FAIL |

\*One `fetch failed` (status 0), zero 503/1102.

**1102:** **0** on all runs — **FIXED**.  
**503:** reproducible at c=12; c=8 passes after probe cooldown (account burst limit).

## Hardening-3 Changes (uncommitted in workspace)

- `s-maxage=86400` on `/emoji/*` (middleware + `_headers`)
- In-flight R2 payload coalescing + skip search read when identity exists (1 read vs 2)

## Production

**Not deployed** — c=12 gate did not achieve 0×503. Prod remains `5e12fc5d`.

## 8.62

**BLOCKED** until 8.61 PASS.

## Build Evidence

| Metric | Value |
|--------|-------|
| Build dir | `C:\temp\emoji-861-build` |
| SSG | 4486 |
| Gzip | ~2719 KiB (hardening-2 baseline; h3 bundle redeployed) |
| Log | `C:\temp\emoji-861-hardening3-build.log` |
