# Phase 8.61 Runtime Hardening (Second Pass)

**Verdict: NOT READY FOR DEPLOY**

**Production (unchanged):** `5e12fc5d-2778-4505-9d51-50d4a04b37ea`
**Failed prior candidate:** `ca943741-fb70-4ac9-8bd8-cb2191398b3a` (a2be639 build - immediate 503, rolled back)
**Prior preview gate:** `14c1b6dd-a6ba-4c8e-b114-5ea0a78203ad` - c=4 FAIL (51/100 on-demand 1102, 7/10 SSG 1102)

## A - Root Cause (expanded)

The a2be639 fix (React cache + 2 R2 reads) addressed on-demand R2 fan-out but did not clear the c=4 gate.

| Symptom | Implication |
|---------|-------------|
| SSG slugs fail 1102 at c=4 (7/10) | Not R2-only - Worker CPU/bundle on pre-rendered paths |
| On-demand still 51/100 at c=4 after 2-read fix | Residual CPU + concurrent isolate pressure |
| ca943741 immediate 503 on deploy | Worker cold-start / bundle init under production load |
| Sequential preview smoke OK | Failure mode is concurrency, not correctness |

Contributing CPU/bundle factors: heavy r2-service import graph on SSG pages, eager edge-context JSON map init, no cross-request R2 payload cache, no edge HTML cache, default OpenNext incremental cache.

## B - Bundle/CPU Reduction (this pass)

- Split `r2-identity-loader.ts` from catalog-heavy `r2-service.ts`
- Dynamic import for on-demand resolver in `identity-page-resolver.ts` and `page.tsx`
- Lazy edge-context map init in `edge-context.ts`
- Bounded immutable R2 payload cache (512 entries) in `master-r2.ts`

## C - Edge HTML Cache

- `public/_headers`: `/emoji/*` Cache-Control public,max-age=3600,stale-while-revalidate=86400
- `src/middleware.ts`: same header on GET /emoji/:slug
- `open-next.config.ts`: staticAssetsIncrementalCache + withRegionalCache

## E - Build

| Attempt | Result |
|---------|--------|
| Workspace build:cf | FAIL - OOM (2GB Rust alloc) |
| C:\\temp\\emoji-861-build | npm ci complete; build pending after commit sync |

Prior known-good: 4486 SSG, gzip 2706.65 KiB (a2be639).

## F - Preview Test

NOT RUN - blocked by build failure. c=4 gate mandatory before prod.

## Final Status

**NOT READY FOR DEPLOY**

Blockers: build:cf OOM; preview c=4 not re-run; production deploy forbidden until zero 1102.
