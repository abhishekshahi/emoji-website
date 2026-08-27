# PHASE STEP 14 — Invisible Characters Tools

**Status:** Implementation complete — **NOT FINAL VERIFIED** (deploy + two live audits pending)

**Git SHA:** `e3d82012f18d4378cdf33cda3de26ed2950d205c`  
**Local BUILD_ID:** `oz1xPZ2ZisDZmUm28wHr-`  
**Production BUILD_ID (pre-deploy):** `Z0kAnJi2M_4MZvBouUPid`  
**Deployment ID:** blocked — `CLOUDFLARE_API_TOKEN` not set in cloud agent environment

---

## Summary

Client-side invisible Unicode character tools: generator, inspector, and explicit cleaner. All processing runs in the browser — pasted text is never sent to EmojiQuick servers.

---

## Top 20 Research (reputable sources studied)

| # | Source | Relevance |
|---|--------|-----------|
| 1 | unicode.org/charts | Official code point names and categories |
| 2 | unicode.org/reports/tr44 | Unicode character properties |
| 3 | unicode.org/reports/tr15 | Normalization (ZWJ/ZWNJ context) |
| 4 | unicode.org/reports/tr9 | Bidirectional algorithm (bidi controls) |
| 5 | fileformat.info | Unicode lookup and copy UX patterns |
| 6 | compart.com/en/unicode | Character inspection reference |
| 7 | unicode-table.com | Code point browsing (not copied) |
| 8 | charactercodes.net | Zero-width character explanations |
| 9 | invisible-characters.com | Generator UX (responsible-use contrast) |
| 10 | emptycharacter.net | Copy UX patterns |
| 11 | codepoints.net | Character metadata API patterns |
| 12 | graphemica.com | Grapheme cluster awareness |
| 13 | emojipedia.org | ZWJ in emoji sequences |
| 14 | MDN Intl.Segmenter | Grapheme counting |
| 15 | MDN Clipboard API | Copy with permission handling |
| 16 | OWASP XSS Prevention | Safe rendering of user text |
| 17 | W3C WCAG 2.2 | Accessibility for non-visual content |
| 18 | schema.org WebApplication | Structured data |
| 19 | Google Search Central | SEO for utility tools |
| 20 | Unicode confusables (UTS #39) | Spoofing awareness |

---

## Routes

| Path | Tool |
|------|------|
| `/tools/invisible-characters` | Index |
| `/tools/invisible-characters/generator` | Copy zero-width characters |
| `/tools/invisible-characters/inspector` | Unicode / invisible inspector |
| `/tools/invisible-characters/cleaner` | Explicit removal |

---

## Supported characters

### Generator (5)

| Code | Name | Notes |
|------|------|-------|
| U+200B | ZERO WIDTH SPACE | Word boundary hint |
| U+200C | ZERO WIDTH NON-JOINER | Prevents cursive joining |
| U+200D | ZERO WIDTH JOINER | Emoji sequences — do not strip blindly |
| U+2060 | WORD JOINER | Prevents line break |
| U+FEFF | BOM / ZWNBSP | Not recommended as general spacer |

### Inspector also detects

- Whitespace: SPACE, TAB, LF, CR, NBSP, thin space, NNBSP, soft hyphen
- Bidi controls: LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI (with warnings)

---

## Tool architecture

```
src/lib/tools/invisible-characters/
  characters.ts   — definitions, lookup, invisible detection
  analyze.ts      — analyzeText, visualizeText, cleanText (MAX 10k UTF-16)
  registry.ts     — page metadata
  sitemap-pages.ts

src/components/tools/
  invisible-char-generator-panel.tsx
  invisible-char-inspector-panel.tsx
  invisible-char-cleaner-panel.tsx
  invisible-char-copy-button.tsx
  invisible-char-tool-nav.tsx
```

All panels are `"use client"` — zero server upload of pasted text.

---

## Security

- React text escaping (no `dangerouslySetInnerHTML` for user input)
- Input bounded to 10,000 UTF-16 units
- Bidi controls identified with warnings, not offered as evasion
- XSS/HTML injection tested in unit tests and audit script
- ZWJ excluded from default clean set (protects emoji sequences)

---

## Privacy

- 100% client-side processing
- No pasted text in URLs, analytics, logs, or server errors
- Privacy notice on every tool page

---

## Accessibility

- Every invisible character shows: name, code point, text label
- Copy buttons with accessible labels
- Warnings use `role="alert"`
- Keyboard-focusable controls

---

## Performance

- O(n) single-pass analysis per input
- MAX_INPUT_LENGTH = 10,000 UTF-16 units
- No server round-trips for inspection

---

## SEO

- Unique title, description, H1 per page
- WebApplication + BreadcrumbList JSON-LD
- Sitemap entries for index + 3 tool pages
- robots.txt allows `/tools/`
- No per-code-point URL explosion

---

## Tests & regression

| Suite | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| Step 14 (11 tests) | PASS |
| `npm run build` | PASS (BUILD_ID `oz1xPZ2ZisDZmUm28wHr-`) |
| `npm run build:cf` | PASS |

Data integrity unchanged: Canonical 63,248 · Public 51,338 · Blocked 11,910

---

## First live audit (B1) — FAIL

**Audited:** 2026-08-27T07:11:35Z  
**Production BUILD_ID:** `Z0kAnJi2M_4MZvBouUPid`

| Severity | Count |
|----------|-------|
| CRITICAL | 1 (blocked kaomoji 503 — production instability) |
| HIGH | 5 (tool routes 404/503, sitemap missing tools) |
| MEDIUM | 1 (robots missing /tools/) |

**Root cause:** Step 14 code not deployed to production.

---

## Second live audit (B2)

**Status:** blocked pending deploy

---

## Deployment blocker

`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are required for `npm run deploy:cf`.

After credentials are provided:

```bash
npm run deploy:cf
curl -s https://emojiquick.com/BUILD_ID
npx tsx scripts/kaomoji/step14-deep-live-audit.ts
npx tsx scripts/kaomoji/step14-deep-live-audit.ts --second
```

---

**STEP 14 — NOT FINAL VERIFIED** until deploy + two passing live audits.

**DO NOT START STEP 15.**
