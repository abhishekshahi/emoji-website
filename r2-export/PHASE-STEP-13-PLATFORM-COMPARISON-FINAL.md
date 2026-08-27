# PHASE STEP 13 — Platform Emoji / Kaomoji Comparison

**Status:** Implementation complete — **FINAL VERIFIED blocked pending production deploy and two live audits**

**Branch:** `cursor/359-kaomoji-promotion`

---

## Summary

Step 13 adds honest platform comparison for Unicode emoji: vendor platform notes, open-source style comparison (Noto, Fluent, OpenMoji, Twemoji), emoji-vs-kaomoji guide, and per-emoji detail integration. No fabricated vendor artwork or rendering claims.

---

## Top-20 Research Sources

Unicode emoji charts, CLDR via emojibase, Emojipedia platform notes, Google Noto documentation, Microsoft Fluent Emoji repository, Twemoji/CC BY 4.0, OpenMoji project, Apple/Samsung/WhatsApp public product descriptions (metadata only), EmojiQuick master artwork index, asset-rights registry, `/styles/comparison` hub, emoji detail technical fields, Schema.org WebPage patterns, accessibility table semantics, mobile responsive comparison tables, license attribution requirements, kaomoji text-face distinction, search benchmark preservation, sitemap discipline, live audit methodology from Steps 11–12.

---

## Platform Scope

| Page | Kind | Verified artwork |
|------|------|------------------|
| `/emoji/platforms` | Index | — |
| `emoji-vs-kaomoji` | Guide | No |
| `open-source-styles` | Comparison | Yes (open-source only) |
| `apple`, `samsung`, `whatsapp` | Vendor notes | No (metadata only) |
| `google`, `microsoft`, `x` | Vendor + open-source proxy | Proxy only |

No mass `apple-vs-google` pair pages.

---

## Implementation

- `src/lib/emoji/platforms/` — registry, resolver, builder, sitemap
- `/emoji/platforms` + `/emoji/platforms/[slug]` (8 pages)
- `EmojiPlatformComparisonSection` on standard emoji detail pages
- Sitemap entries for platform pages
- Tests + live audit script

---

## Accuracy Rules

- Unicode character shown as system glyph
- Open-source artwork only where license permits
- Vendor platforms: "Platform artwork may vary" — no proprietary binaries hosted
- Kaomoji: text composition distinction documented

---

## Tests

| `npm run typecheck` | PASS |
| Step 13 (10 tests) | PASS |
| Step 12 regression | PASS |
| `npm run build` | PASS (local BUILD_ID `jx8AMGFerFoJS2L_dHzeU`) |
| `npm run build:cf` | PASS |

---

## Live Audits

**First audit (B1): FAIL** — production still on BUILD_ID `jBTM3zuDHiOQZYEJ23nV8`. Platform routes 404; expected until deploy.

Deploy blocked: `CLOUDFLARE_API_TOKEN` not set.

After deploy:

```bash
npx tsx scripts/kaomoji/step13-deep-live-audit.ts
npx tsx scripts/kaomoji/step13-deep-live-audit.ts --second
```

---

## Data Integrity (unchanged)

Canonical 63,248 · Public 51,338 · Blocked 11,910 · RAW 236,508 · Relationships 396,162

---

**STEP 13 — NOT FINAL VERIFIED** until deploy + two passing live audits.

**DO NOT START STEP 14.**
