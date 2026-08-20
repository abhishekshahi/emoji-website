# Phase 8.61 — Independent Parallel Validation (Agent 2)

| Field | Value |
| --- | --- |
| Branch | phase-8.12E-seo-canary |
| Commit | a2be639 |
| Overall verdict | PASS WITH WARNINGS |

See r2-export/manifests/phase-8-61-independent-audit.json for full gate JSON.

## Gate Results Summary

| # | Gate | Local | Prod | Overall |
| 1 | Identity catalog | PASS | N/A | PASS |
| 2 | Dynamic 2469 | PASS | NOT VERIFIED | PASS |
| 3 | Sample 4486 pages | PASS | NOT VERIFIED | PASS |
| 4 | SEO code | PASS | NOT VERIFIED | PASS |
| 5 | Sitemap | PASS | NOT VERIFIED | PASS |
| 6 | Robots | PASS | NOT VERIFIED | PASS WITH WARNINGS |
| 7 | Artwork fallback | PASS | N/A | PASS WITH WARNINGS |
| 8 | R2/security | PASS | N/A | PASS |
| 9 | Runtime fix a2be639 | PASS | NOT VERIFIED | PASS |
| 10 | Architecture | PASS | N/A | PASS |
| 11 | Smoke checklist | PREPARED | N/A | PREPARED |
| 12 | Prod spot checks | N/A | NOT VERIFIED | NOT VERIFIED |

Production returned HTTP 503 during Agent 1 deploy at audit end.
## Production Probe Update (Agent 2, 2026-08-15T06:42Z)

- Active worker: 5e12fc5d-2778-4505-9d51-50d4a04b37ea (Rollback)
- Deploy ca943741 at 06:22Z rolled back again at 06:25Z
- Smoke: 8x503 (Worker exceeded resource limits), 2x200 (/robots.txt, /search EmojiFind)
- On-demand c=4 (50 slugs): 44x503, 6x404, 0x200
- On-demand c=12: ABORTED (production hung)
- Remote sitemap: HTTP 500
- Ready for Agent 1 mass validate: NO

## Hardening-2 Prep (Agent 2, 2026-08-15T07:00Z)

Branch `phase-8.12E-seo-canary` @ `9f9bd5e`. Baseline for diff: `0b27bd1ee` (pre-8.61 hybrid). Rollback worker: `5e12fc5d-2778-4505-9d51-50d4a04b37ea`. Failed candidate deploy: `ca943741-fb70-4ac9-8bd8-cb2191398b3a` (rolled back 06:25Z, re-confirmed active 06:48Z).

### Production baseline health (read-only)

| Route | Status (07:00Z probe) | Notes |
| --- | --- | --- |
| `/` | 200 (intermittent 503 under parallel load) | Static/home SSR still hits worker |
| `/emoji/grinning-face` | 503 | On-demand emoji SSR failing on rollback worker |
| `/sitemap.xml` | 503 | Large dynamic sitemap generation |
| `/robots.txt` | 200 | Served without worker CPU spike |

Active deployment per `wrangler deployments list`: **100% `5e12fc5d-2778-4505-9d51-50d4a04b37ea`**.

### Top 10 Worker CPU suspects (baseline `0b27bd1ee` → candidate `9f9bd5e`)

| Rank | Suspect | Evidence | Delta vs healthy |
| --- | --- | --- | --- |
| 1 | `emoji-enrichment.json` eager import + per-slug expand | `src/lib/emoji/enrichment.ts:3,9-30` — 4.55 MiB JSON parsed at module init; `expandCompactRecord` on every page hit | **NEW** (file absent at `0b27bd1ee`) |
| 2 | `identity-slug-map.json` module init | `src/lib/master/public/identity-slug-map.ts:1,25-29` — 1.61 MiB / 6955 entries, 3 Maps built at import | **NEW** |
| 3 | `generateMetadata` enrichment + R2 identity path | `src/app/emoji/[slug]/page.tsx:72-98` — calls `getEmojiEnrichmentBySlug` then `resolveEmojiPage` (R2) for non-browsable slugs | Metadata work **2×** per request (metadata + render); R2 path **NEW** |
| 4 | On-demand master-identity R2 reads | `src/lib/master/public/identity-page-resolver.ts:71-73`, `src/lib/r2/master-r2.ts:246-263` — 2 parallel R2 JSON reads per identity page | **NEW** hybrid route (`59472036b`); trimmed from 4 reads in `a2be639c7` |
| 5 | Emoji page render fan-out (7 sections) | `src/app/emoji/[slug]/page.tsx:118-187` — enrichment model builders + 8 child components vs inline template at baseline | **~3×** server JSX work |
| 6 | `emojis.json` always bundled | `src/lib/emoji/data.ts:1,25-30` — 2.76 MiB, 3 Maps at import on every emoji route | unchanged size; now paired with enrichment |
| 7 | `generateStaticParams` / sitemap slug explosion | `src/app/emoji/[slug]/page.tsx:53-55`, `src/lib/emoji/browsable-data.ts:44-48` — up to **6955** slugs vs browsable-only (~4486 Unicode + extras) | **+2470** on-demand ISR targets |
| 8 | `getEmojiMasterBundle` (5 R2 reads) still exported | `src/lib/r2/master-r2.ts:266-296` — identity+metadata+semantic+search+provenance parallel fetch if any caller invokes it | verify no emoji hot-path callers |
| 9 | Middleware async dynamic import | `src/middleware.ts:5-12` — rollout gate + lazy `active-migration` import on `/emoji/*` | low in prod (`MASTER_SEO_ROLLOUT_MODE=OFF`) |
| 10 | No edge cache on HTML/sitemap | `public/_headers:1-2` — only `/_next/static/*` immutable; emoji pages fully dynamic | **NEW** `_headers` file, no HTML caching |

### Rollback `5e12fc5d` vs candidate `ca943741` — modules NOW that did not exist at rollback code era

Quantified bundle bloat introduced by commit `59472036b` (hybrid emoji pages):

| Source | Size / count | Worker impact |
| --- | --- | --- |
| `src/data/emoji-enrichment.json` | 4,546,292 B, 4486 records | Parsed once per isolate; expand per slug |
| `src/data/master/integration/identity-slug-map.json` | 1,610,883 B, 6955 entries | Import-time Map construction |
| `src/lib/emoji/enrichment*.ts` + `emoji-page-model.ts` | ~15 new modules | CPU on every browsable emoji page |
| `src/lib/master/public/identity-page-resolver.ts` | 95 lines | R2 subrequests for non-browsable slugs |
| `src/lib/master/public/identity-slug-map.ts` | 36 lines | Slug lookup for all hybrid routes |
| `src/components/master/master-identity-detail-page.tsx` | new route | Extra SSR for ~2470 master-only slugs |
| 6 new emoji section components | hero/meaning/names/variants/technical/artwork-panel | Larger React tree vs baseline inline JSX |
| `dynamicParams = true` | `page.tsx:51` | All 6955 slugs eligible for on-demand SSR |

Candidate-only runtime fix (`a2be639c7`): `getPublicIdentityR2Payload` + `cache(resolveEmojiPage)` — reduces duplicate R2 reads but **does not remove** enrichment JSON or expanded JSX cost.

### Concurrency probe script

Ready at `scripts/audit/phase-8-61-concurrency-probe.cjs`.

```bash
node scripts/audit/phase-8-61-concurrency-probe.cjs --concurrency=4 --limit=50
node scripts/audit/phase-8-61-concurrency-probe.cjs --concurrency=12 --slugs-file=src/data/master/integration/identity-slug-map.json
```

Outputs JSON with `count200`, `count503`, `count1102`, `counts`, `sampleFailures`. Exit code 1 if any 503/1102.

Smoke (c=1, limit=2 @ 07:00Z): 2×503, 0×1102, 0×200.

### Edge cache recommendations for Agent 1 (code-only audit)

1. **Emoji HTML**: add `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` via `next.config.ts` `headers()` for `/emoji/:slug*` — rollback worker serves stable content.
2. **Sitemap**: cache `/sitemap.xml` at edge (`s-maxage=86400`) or pre-generate static asset during build to avoid 503 under probe load.
3. **R2 JSON responses**: if `/api/master/*` routes remain, add short `s-maxage` + `Cache-Control` on successful identity payloads.
4. **`public/_headers`**: extend beyond `/_next/static/*` — OpenNext assets directory supports route patterns for HTML if emitted to assets.
5. **ISR/static**: prefer `generateStaticParams` prebuild for top N slugs + longer `revalidate` instead of pure on-demand for all 6955.
6. **Middleware**: keep redirect module lazy-loaded (already done); ensure `MASTER_SEO_ROLLOUT_MODE=OFF` in prod wrangler vars to skip `/emoji/*` middleware work entirely.

### Time saved for Agent 1

- CPU suspect table with file:line anchors (no manual diff needed)
- Prod deployment ID + health snapshot confirmed
- Concurrency probe script ready for immediate c=4 / c=12 validation
- Edge cache recommendation list (no code changes applied here)
