# Phase 8.61 Runtime Hardening

**Verdict: FIX APPLIED — local gates PASS; Cloudflare c=4 gate FAIL (see PHASE-8.61-RUNTIME-FINAL-AUDIT.md)**

**Production (unchanged):** `5e12fc5d-2778-4505-9d51-50d4a04b37ea`  
**Failed candidate (root cause):** `cafaa272` / `a2f62b01` — HTTP 1102 under concurrent on-demand R2 load

## Root Cause

On-demand master identity pages (`2469` slugs) hit R2 through `buildPublicIdentityResponseFromR2` → `loadR2IdentityPayload`, which performed **4 parallel R2 reads per resolution** (`identity`, `search`, `metadata`, `semantic`). Each HTTP request invoked that path **twice** — once in `generateMetadata` and again in the page component — because `resolveEmojiPage` was not request-deduped. Under mass validation at concurrency 24, this produced up to **8 R2 subrequests + 8 JSON parses per on-demand page**, exhausting Worker CPU/subrequest budget → **503 error 1102**.

Contributing factors ruled out: bundle size (gzip ~2706 KiB PASS), sitemap, R2 completeness, individual sequential probes (200 OK).

## Fix (minimal diff)

1. **`getPublicIdentityR2Payload`** (`src/lib/r2/master-r2.ts`) — React `cache()` wrapper fetching only **identity + search** (2 reads). Metadata/semantic omitted; master identity pages do not render semantic terms.
2. **`loadR2IdentityPayload`** (`src/lib/master/public/r2-service.ts`) — uses cached minimal payload instead of 4 direct adapter reads.
3. **`resolveEmojiPage`** (`src/lib/master/public/identity-page-resolver.ts`) — wrapped with React `cache()` to dedupe `generateMetadata` + page render within the same request.

**Per on-demand page request (before → after):** up to **8 R2 reads** → **2 R2 reads** (~75% reduction). No unsafe global mutable caches added.

## Resource Improvement

| Metric | Before | After |
|--------|--------|-------|
| R2 reads / on-demand page (metadata+page) | up to 8 | 2 |
| R2 object types fetched | 4 | 2 |
| Request-local dedupe (metadata+page) | none | React `cache()` |
| 100 concurrent local resolutions | not tested | **208 ms**, 100/100 OK |

## Local Gate Results

| Gate | Result | Notes |
|------|--------|-------|
| `npm run typecheck` | **PASS** | |
| Targeted tests (master/r2/public) | **PASS** (24/25) | 1 pre-existing env fail: `isR2MetadataBackendActive` true when `.dev.vars` has `MASTER_R2_MODE=ENABLED` |
| Runtime: 1 on-demand slug (`ca`) | **PASS** | resolver + payload cache |
| Runtime: 10 on-demand slugs | **PASS** | included in 100-slug batch |
| Runtime: 100 on-demand slugs concurrent | **PASS** | 208 ms local |
| HTTP preview / wrangler dev @ c=24 | **NOT RUN** | deploy blocked per instructions |
| Mass 6955 validation | **NOT RUN** | blocked per instructions |

## 1102 Status

| Environment | Status |
|-------------|--------|
| Production (rollback) | **Healthy** — no change deployed |
| Failed candidate (pre-fix) | **1102 reproduced** — 3050/6955 @ c=24 |
| Local resolver simulation | **No exhaustion** — 100/100 @ unbounded Promise.all |
| Post-fix Cloudflare worker (preview) | **FAIL @ c=4** — 51/100 on-demand 1102; 7/10 SSG 1102 |

## Deploy Readiness

**NO** — build:cf executed (gzip 2706.65 KiB, 4486 SSG). Preview deploy tested; **c=4 gate FAIL** (1102). Production deploy rolled back.

### Blockers before deploy

1. Build candidate from fixed branch (`build:cf` from clean tree)
2. Preview worker smoke: 1 → 10 → 50 → 100 on-demand slugs
3. Controlled concurrent probe (c=4 → 12 → 24) on preview — confirm zero 1102
4. Optional: limited mass validation subset (not full 6955 until preview clean)

## Files Changed

- `src/lib/r2/master-r2.ts` — add `getPublicIdentityR2Payload`
- `src/lib/r2/index.ts` — export
- `src/lib/master/public/r2-service.ts` — minimal cached payload
- `src/lib/master/public/identity-page-resolver.ts` — `cache()` wrapper
- `src/lib/r2/master-r2.test.ts` — runtime hardening tests
