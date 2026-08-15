# Phase 8.59-D — Robots / Indexing

**Status:** PASS WITH WARNINGS

## Production robots.txt

Cloudflare Managed Content-Signal block prepended, then app rules:

- Allow: `/`, `/emoji/`, `/category/`, `/popular`, `/new`, `/search`, `/licenses`, `/extras`
- Disallow: `/favorites`, `/recent`
- Sitemap: `https://emojiquick.com/sitemap.xml`

## Checks

| Check | Result |
|-------|--------|
| Emoji crawlable | PASS |
| Sitemap directive | PASS |
| /favorites blocked | PASS |
| /recent blocked | PASS |
| /api/* explicitly disallowed | **WARN** — not in Disallow list |

## API / Private Paths

- `/api/master/catalog` returns 200 but is **not in sitemap**
- Master artwork served via API but not indexed in sitemap/OG
- R2 bucket `emojiquick-master`: PRIVATE (not web-exposed)

## Warning

Recommend adding `Disallow: /api/` in a future hardening pass. Not blocking — API paths absent from sitemap.
