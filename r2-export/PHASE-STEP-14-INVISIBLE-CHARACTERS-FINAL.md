# PHASE STEP 14 — Invisible Characters Tools

**Status:** Implementation complete — **FINAL VERIFIED blocked pending production deploy and two live audits**

---

## Summary

Client-side invisible Unicode character tools: generator, inspector, and explicit cleaner. All processing in the browser — pasted text never sent to servers.

---

## Routes

| Path | Tool |
|------|------|
| `/tools/invisible-characters` | Index |
| `/tools/invisible-characters/generator` | Copy zero-width characters |
| `/tools/invisible-characters/inspector` | Unicode / invisible inspector |
| `/tools/invisible-characters/cleaner` | Explicit removal |

---

## Supported characters (generator)

U+200B ZWSP · U+200C ZWNJ · U+200D ZWJ · U+2060 WJ · U+FEFF BOM/ZWNBSP

---

## Safety & privacy

- Responsible-use warnings on every tool
- Bidi control detection with warnings (not evasion)
- ZWJ excluded from default clean set
- MAX_INPUT_LENGTH 10,000 UTF-16 units
- No server upload of pasted text
- React text escaping (no `dangerouslySetInnerHTML` for user input)

---

## Tests

| Suite | Result |
|-------|--------|
| `npm run typecheck` | Pending |
| Step 14 (11 tests) | Pending |

---

**STEP 14 — NOT FINAL VERIFIED** until deploy + two passing live audits.

**DO NOT START STEP 15.**
