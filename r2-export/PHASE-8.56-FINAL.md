# Phase 8.56 — Production Canary Deploy

**PASS** — Phase 8.56-B fix deployed and smoke-verified

## Production

| Field | Value |
|-------|-------|
| Active version ID | `cc87fcd2-95b6-4708-a451-0d55a3b108e8` |
| Prior rollback baseline | `5e12fc5d-2778-4505-9d51-50d4a04b37ea` |
| Failed prior candidate | `969b444e-ceaa-4279-be2e-12b1dc1a1718` (stale bundle, master API 500) |
| Gzip upload | 2506.06 KiB (< 3072 KiB limit) |
| minify | true |
| Commit | `0b27bd1e` Phase 8.56-B master API R2 wiring |

## Build

| Item | Status |
|------|--------|
| Build path | `C:\temp\emoji-856-build` (OOM mitigation) |
| Build log | `r2-export/phase-8.56-b-build-cf.log` |
| OpenNext worker | `.open-next/worker.js` present |
| Handler gzip (pre-deploy gate) | 2304.98 KiB |

## Bundle gate (pre-deploy)

All four bundled `api/master/*/route.js` handlers contain R2 ternary branch (`shouldReadFromR2Binding ? await r2Service : localFallback`). Bare `getMasterReader(process.cwd())` only appears in local-fallback branches, not as sole GET path.

| Route | R2 ternary | Evidence |
|-------|------------|----------|
| catalog | PASS | `(0,g.N1)()?await (0,i.fh)(...):(0,f.il)(...)` |
| search | PASS | `(0,i.N1)()?await (0,k.Gn)(...):(0,f.C)(...,process.cwd(),...)` |
| identity | PASS | R2 ternary present |
| artwork | PASS | R2 ternary present |

## Deploy

| Item | Value |
|------|-------|
| Deploy log | `r2-export/phase-8.56-b-deploy.log` |
| Bindings | MASTER_R2, ASSETS, WORKER_SELF_REFERENCE |
| Vars | MASTER_R2_MODE=ENABLED, PUBLIC_MASTER_PLATFORM_MODE=ENABLED, MASTER_SEO_ROLLOUT_MODE=OFF |

## Smoke (production, parallel — both hosts)

**28/28 PASS** — evidence: `r2-export/phase-8.56-b-smoke.json`

### Emoji pages — PASS (all 200)

| Path | emojiquick.com | workers.dev |
|------|----------------|-------------|
| `/` | 200 | 200 |
| `/search` | 200 | 200 |
| `/emoji/fire` | 200 | 200 |
| `/emoji/red-heart` | 200 | 200 |
| `/emoji/keycap` | 200 | 200 |
| `/emoji/family-man-woman-boy` (ZWJ) | 200 | 200 |
| `/emoji/waving-hand-light-skin-tone` | 200 | 200 |
| `/emoji/flag-united-states` | 200 | 200 |
| `/sitemap.xml` | 200 | 200 |
| `/robots.txt` | 200 | 200 |

### Master public APIs — PASS (all 200)

| Path | emojiquick.com | workers.dev |
|------|----------------|-------------|
| `/api/master/catalog` | 200 | 200 |
| `/api/master/search?q=fire` | 200 | 200 |
| `/api/master/identity/1F525` | 200 | 200 |
| `/api/master/artwork/1F525` | 200 | 200 |

## R2

No re-upload. Bucket `emojiquick-master` unchanged (114498 objects, PRIVATE).

## Fix applied (8.56-B)

Tracked and deployed untracked master API + R2 modules; rebuilt from `C:\temp\emoji-856-build` with `NODE_OPTIONS=--max-old-space-size=8192`; pre-deploy bundle gate verified R2 symbols; deployed canary `cc87fcd2`.

See `r2-export/PHASE-8.56-B-FIX.md` for full fix narrative.
