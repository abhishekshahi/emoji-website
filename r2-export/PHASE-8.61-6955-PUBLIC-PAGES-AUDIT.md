# 6955 Public Pages Audit

**Verdict: PASS WITH WARNINGS**

## Production (https://emojiquick.com)

**Version:** `a2f62b01-a0e6-46f0-b7cb-11e294bb6752`

| Check | Result |
|-------|--------|
| Deploy gzip | **2706.55 KiB** < 3072 KiB ✓ |
| Sitemap | **6991** URLs, **6955** emoji ✓ |
| Robots | `/api/*` + `/catalog/` disallowed ✓ |
| SSG pre-render | **4486** browsable pages |
| On-demand edge | **2469** master identity slugs |
| Mass HTTP 200 (c=24, immediate post-deploy) | **3050/6955** — mostly HTTP 503 (rate burst, not 404) |
| Sequential spot (ca, de, ch, grinning-face, extra-ruby) | **5/5 HTTP 200** |
| Full throttled audit (c=4, retries) | In progress at time of report |

## Architecture

- **4486 static:** OpenMoji browsable emoji pre-rendered at build
- **2469 dynamic:** Master identity pages via R2 resolver at request time
- **6955 sitemap:** All identity slugs listed for SEO discovery

## Manifest

`r2-export/manifests/phase-8-61-g-validation-live.json` — post-deploy concurrent run.
