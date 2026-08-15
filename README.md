# EmojiQuick

Next.js emoji search and reference site. **Production runs on Cloudflare Workers** via [OpenNext for Cloudflare](https://opennext.js.org/cloudflare).

- **Production:** [emojiquick.com](https://emojiquick.com)
- **Worker (preview / QA):** `https://emoji-website.emoji-website.workers.dev`

## Quick start (local dev)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local dev uses `initOpenNextCloudflareForDev()` in `next.config.ts` so R2 bindings and Worker env vars behave like production when `.dev.vars` is present.

## Build & deploy (Cloudflare — primary path)

| Script | Purpose |
|--------|---------|
| `npm run build:cf` | OpenNext build → `.open-next/` Worker bundle + static assets |
| `npm run preview:cf` | Local preview of the Cloudflare bundle |
| `npm run deploy:cf` | Build and deploy to Cloudflare Workers |

### Prerequisites

1. [Cloudflare account](https://dash.cloudflare.com/) with Workers enabled
2. `npx wrangler login` (OAuth)
3. Copy `.env.example` → `.dev.vars` for local Cloudflare dev
4. R2 bucket `emojiquick-master` provisioned (private; bound in `wrangler.jsonc`)

### Deploy checklist

```bash
# 1. Dry-run size check (gzip must stay under 3072 KiB on free tier)
npx wrangler deploy --dry-run

# 2. Build
npm run build:cf

# 3. Deploy
npm run deploy:cf

# 4. Roll back if needed (does not touch DNS or R2)
npx wrangler versions deploy <version-id>
```

See [DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md) for the full stack, DNS, R2, and rollback runbook.

> **Do not deploy Phase 8.61 candidates** until the c=4 concurrency gate passes. Production is pinned to Worker version `5e12fc5d` (see `r2-export/CLOUDFLARE-ONLY-MIGRATION.md`).

## Configuration

| File | Role |
|------|------|
| `wrangler.jsonc` | Production Worker: R2 binding, assets, env vars |
| `wrangler.canary-staging.jsonc` | Staging canary Worker (`MASTER_SEO_ROLLOUT_MODE=CANARY`) |
| `open-next.config.ts` | OpenNext incremental cache (regional + static assets) |
| `next.config.ts` | Next.js config + Cloudflare dev shim |
| `.dev.vars` | Local Worker env (not committed) |

### Key environment variables

| Variable | Values | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_SITE_URL` | `https://emojiquick.com` | Canonical URLs, sitemap, OG |
| `MASTER_R2_MODE` | `OFF` \| `DATA_READY` \| `ENABLED` | R2 data layer |
| `PUBLIC_MASTER_PLATFORM_MODE` | `OFF` \| `LOCAL` \| `ENABLED` | Public master API |
| `MASTER_SEO_ROLLOUT_MODE` | `OFF` \| `CANARY` \| `FULL` | SEO rollout gate |

Set production values in `wrangler.jsonc` → `vars`. Override locally in `.dev.vars`.

## Data & R2 scripts

Master emoji data lives in R2 (`emojiquick-master`, **private**). Local export/verify scripts:

```bash
npm run r2:prepare      # Build local export manifest
npm run r2:verify       # Validate export integrity
npm run r2:check-account # Verify R2 account access
```

Upload scripts exist for bulk data migration but are **not** part of the routine deploy path.

## Tests & audits

```bash
npm test
npm run typecheck
npm run lint
npm run audit:production
npm run master:build-cloudflare-proof
```

## Vercel (deprecated)

Vercel was used for early hosting and SEO canary experiments (Phase 8.12H). **All production traffic is on Cloudflare.** Vercel deploy paths, `.vercelignore`, and rolling-release canary scripts are deprecated. See `r2-export/CLOUDFLARE-ONLY-MIGRATION.md` for the migration record.
