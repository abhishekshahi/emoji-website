# Phase 8.1 — Complete All-Source Inventory and Version Lock

**Audited at:** 2026-08-09T02:17:30.572Z

## F. Existing EmojiFind Baseline (unchanged)

| Metric | Count |
| --- | ---: |
| Standard records | 3944 |
| OpenMoji extras | 405 |
| Unicode extras | 137 |
| Total extras | 542 |
| Searchable items | 4486 |

Verified on disk:
- emojis.json: 3944
- openmoji-extras.json: 542
- OpenMoji artwork: 3944 standard / 405 extras-openmoji / 137 extras-unicode

## Source Inventory

### OpenMoji (`openmoji`)

| Field | Value |
| --- | --- |
| Version | 17.0.0 |
| Tag | 17.0.0 |
| Commit | — |
| Lock status | locked |
| License | CC BY-SA 4.0 |
| License URL | https://creativecommons.org/licenses/by-sa/4.0/ |
| Source URL | https://openmoji.org/ |
| Repository | https://github.com/hfg-gmuend/openmoji |
| Unicode version | 17.0 |
| Artwork count | 4486 |
| Emoji records | 4486 |
| Metadata records | 4486 |
| Official/standard data | 3944 |
| Additional/source-specific | 542 |
| Unicode identities | 4081 |
| Non-Unicode identities | 405 |
| Unmatched data | 0 |

**Contributes:** artwork, metadata, standard Unicode emoji records, OpenMoji extras, Unicode extras, source identifiers

**Lock notes:**
- npm package openmoji@17.0.0 installed and verified.

### Unicode Emoji Data (`unicode-emoji-data`)

| Field | Value |
| --- | --- |
| Version | 17.0.0 |
| Tag | — |
| Commit | — |
| Lock status | partial |
| License | Unicode Terms of Use |
| License URL | https://www.unicode.org/copyright.html |
| Source URL | https://www.unicode.org/Public/emoji/17.0/ |
| Repository | https://www.unicode.org/Public/emoji/17.0/ |
| Unicode version | 17.0 |
| Artwork count | 0 |
| Emoji records | 5225 |
| Metadata records | 5225 |
| Official/standard data | 8280 |
| Additional/source-specific | 0 |
| Unicode identities | 5225 |
| Non-Unicode identities | 0 |
| Unmatched data | UNRESOLVED |

**Contributes:** emoji-test data, emoji-sequences, emoji-zwj-sequences, qualification status, Unicode version, canonical sequence identity

**Lock notes:**
- Local vendored snapshot at data/unicode-source/.
- emoji-data.txt not yet vendored locally.

### Unicode / CLDR (`unicode`)

| Field | Value |
| --- | --- |
| Version | 17.0.0 |
| Tag | — |
| Commit | — |
| Lock status | partial |
| License | Unicode Terms of Use |
| License URL | https://www.unicode.org/copyright.html |
| Source URL | https://www.unicode.org/reports/tr51/ |
| Repository | https://www.unicode.org/Public/17.0.0/ |
| Unicode version | 17.0 |
| Artwork count | 0 |
| Emoji records | 3979 |
| Metadata records | 3979 |
| Official/standard data | 8280 |
| Additional/source-specific | 0 |
| Unicode identities | 3979 |
| Non-Unicode identities | 0 |
| Unmatched data | UNRESOLVED |

**Contributes:** CLDR short names, CLDR annotations/keywords, Unicode properties, TR51 sequence rules, variation sequences

**Lock notes:**
- CLDR emoji annotations accessed via emojibase-data@17.0.0 (CLDR 48).
- Direct CLDR XML files not separately vendored.

### Emojibase (`emojibase`)

| Field | Value |
| --- | --- |
| Version | 17.0.0 |
| Tag | 17.0.0 |
| Commit | — |
| Lock status | locked |
| License | MIT |
| License URL | https://opensource.org/licenses/MIT |
| Source URL | https://github.com/milesj/emojibase |
| Repository | https://github.com/milesj/emojibase |
| Unicode version | 17.0 |
| Artwork count | 0 |
| Emoji records | 3979 |
| Metadata records | 3979 |
| Official/standard data | 3979 |
| Additional/source-specific | 0 |
| Unicode identities | 3979 |
| Non-Unicode identities | 0 |
| Unmatched data | 0 |

**Contributes:** labels, tags, shortcodes, groups, subgroups, emoji versions, skin tones, gender, CLDR annotations mirror, localization structure

**Lock notes:**
- emojibase@17.0.0 and emojibase-data@17.0.0 installed.
- Supports Emoji 17.0 / Unicode 17.0 / CLDR 48.

### Emojilib (`emojilib`)

| Field | Value |
| --- | --- |
| Version | 4.0.3 |
| Tag | v4.0.3 |
| Commit | — |
| Lock status | locked |
| License | MIT |
| License URL | https://opensource.org/licenses/MIT |
| Source URL | https://github.com/muan/emojilib |
| Repository | https://github.com/muan/emojilib |
| Unicode version | UNRESOLVED |
| Artwork count | 0 |
| Emoji records | 1914 |
| Metadata records | 1914 |
| Official/standard data | 0 |
| Additional/source-specific | 1914 |
| Unicode identities | 1914 |
| Non-Unicode identities | 0 |
| Unmatched data | UNRESOLVED |

**Contributes:** emoji keyword records, search aliases, English keywords

**Lock notes:**
- Package version 4.0.3 locked. Not installed in project node_modules (audit via npm registry).
- Emojilib 4.x uses dist/emoji-en-US.json format.

### EmojiNet (`emojinet`)

| Field | Value |
| --- | --- |
| Version | UNRESOLVED |
| Tag | — |
| Commit | — |
| Lock status | unresolved |
| License | CC BY-NC-SA 4.0 |
| License URL | https://creativecommons.org/licenses/by-nc-sa/4.0/ |
| Source URL | https://www.emojinet.org/ |
| Repository | https://github.com/usc-isi-i2/emojinet |
| Unicode version | UNRESOLVED |
| Artwork count | 0 |
| Emoji records | UNRESOLVED |
| Metadata records | UNRESOLVED |
| Official/standard data | 0 |
| Additional/source-specific | UNRESOLVED |
| Unicode identities | UNRESOLVED |
| Non-Unicode identities | UNRESOLVED |
| Unmatched data | UNRESOLVED |

**Contributes:** semantic senses, meanings, definitions, contexts, related concepts

**Lock notes:**
- Official GitHub repository usc-isi-i2/emojinet returned 404 during audit.
- Official download endpoint returned HTTP 500 during audit.
- Exact dataset version and commit SHA could NOT be established.
- DO NOT GUESS — must be resolved before 8.2 ingestion.

### Emoji Time (`emoji-time`)

| Field | Value |
| --- | --- |
| Version | 2.2.5 |
| Tag | — |
| Commit | — |
| Lock status | locked |
| License | MIT |
| License URL | https://opensource.org/licenses/MIT |
| Source URL | https://www.npmjs.com/package/emoji-time |
| Repository | https://github.com/caub/emoji-time |
| Unicode version | N/A |
| Artwork count | 0 |
| Emoji records | 24 |
| Metadata records | 24 |
| Official/standard data | 0 |
| Additional/source-specific | 24 |
| Unicode identities | 24 |
| Non-Unicode identities | 0 |
| Unmatched data | UNRESOLVED |

**Contributes:** time-to-emoji utility mappings, clock-face emoji references

**Lock notes:**
- Utility library mapping clock times to clock-face emoji (U+1F550–U+1F567).
- Not a full emoji dataset. Preserved as source mapping in 8.2.

### Twemoji (`twemoji`)

| Field | Value |
| --- | --- |
| Version | 17.0.3 |
| Tag | v17.0.3 |
| Commit | b6b55fef1e8636b540a6d016a4729ca8cdf2e60b |
| Lock status | locked |
| License | CC BY 4.0 |
| License URL | https://creativecommons.org/licenses/by/4.0/ |
| Source URL | https://github.com/jdecked/twemoji |
| Repository | https://github.com/jdecked/twemoji |
| Unicode version | 17.0 |
| Artwork count | UNRESOLVED |
| Emoji records | UNRESOLVED |
| Metadata records | UNRESOLVED |
| Official/standard data | 0 |
| Additional/source-specific | 0 |
| Unicode identities | UNRESOLVED |
| Non-Unicode identities | 0 |
| Unmatched data | UNRESOLVED |

**Contributes:** SVG artwork, PNG artwork, hexcode-keyed assets

**Lock notes:**
- npm @twemoji/api@17.0.3 available.
- Git tag v17.0.3 → commit b6b55fef1e8636b540a6d016a4729ca8cdf2e60b.
- Not installed in project node_modules (audit via registry + GitHub).

### Google Noto Emoji (`noto`)

| Field | Value |
| --- | --- |
| Version | 2.051 |
| Tag | — |
| Commit | 8998f5dd683424a73e2314a8c1f1e359c19e8742 |
| Lock status | locked |
| License | Apache-2.0 |
| License URL | https://www.apache.org/licenses/LICENSE-2.0 |
| Source URL | https://github.com/googlefonts/noto-emoji |
| Repository | https://github.com/googlefonts/noto-emoji |
| Unicode version | 17.0 |
| Artwork count | UNRESOLVED |
| Emoji records | UNRESOLVED |
| Metadata records | UNRESOLVED |
| Official/standard data | 0 |
| Additional/source-specific | 0 |
| Unicode identities | UNRESOLVED |
| Non-Unicode identities | 0 |
| Unmatched data | UNRESOLVED |

**Contributes:** SVG artwork, PNG artwork, font emoji assets

**Lock notes:**
- Commit 8998f5dd683424a73e2314a8c1f1e359c19e8742 is merge PR #515 (v2.051, Unicode 17 / e17 branch).
- No npm package. Git commit SHA locked.

### Microsoft Fluent Emoji (`fluent`)

| Field | Value |
| --- | --- |
| Version | UNRESOLVED |
| Tag | — |
| Commit | 62ecdc0d7ca5c6df32148c169556bc8d3782fca4 |
| Lock status | partial |
| License | MIT |
| License URL | https://opensource.org/licenses/MIT |
| Source URL | https://github.com/microsoft/fluentui-emoji |
| Repository | https://github.com/microsoft/fluentui-emoji |
| Unicode version | UNRESOLVED |
| Artwork count | UNRESOLVED |
| Emoji records | UNRESOLVED |
| Metadata records | UNRESOLVED |
| Official/standard data | 0 |
| Additional/source-specific | UNRESOLVED |
| Unicode identities | UNRESOLVED |
| Non-Unicode identities | UNRESOLVED |
| Unmatched data | UNRESOLVED |

**Contributes:** SVG artwork (3D, Color, Flat, High Contrast), per-emoji metadata JSON, unicode codepoint in filenames

**Lock notes:**
- Commit 62ecdc0d7ca5c6df32148c169556bc8d3782fca4 locked (2025-01-30).
- No semver release tag matched at audit time — commit SHA used instead of 'main'.
- Unicode version coverage for this commit not explicitly labeled.

## G. Version Lock Summary

| Source | Version | Tag | Commit | Status |
| --- | --- | --- | --- | --- |
| OpenMoji | 17.0.0 | 17.0.0 | — | locked |
| Unicode Emoji Data | 17.0.0 | — | — | partial |
| Unicode / CLDR | 17.0.0 | — | — | partial |
| Emojibase | 17.0.0 | 17.0.0 | — | locked |
| Emojilib | 4.0.3 | v4.0.3 | — | locked |
| EmojiNet | UNRESOLVED | — | — | unresolved |
| Emoji Time | 2.2.5 | — | — | locked |
| Twemoji | 17.0.3 | v17.0.3 | b6b55fef1e86 | locked |
| Google Noto Emoji | 2.051 | — | 8998f5dd6834 | locked |
| Microsoft Fluent Emoji | UNRESOLVED | — | 62ecdc0d7ca5 | partial |

## Unresolved Items (must be resolved before 8.2)

- **Unicode Emoji Data**: Local vendored snapshot at data/unicode-source/. emoji-data.txt not yet vendored locally.
- **Unicode / CLDR**: CLDR emoji annotations accessed via emojibase-data@17.0.0 (CLDR 48). Direct CLDR XML files not separately vendored.
- **EmojiNet**: Official GitHub repository usc-isi-i2/emojinet returned 404 during audit. Official download endpoint returned HTTP 500 during audit. Exact dataset version and commit SHA could NOT be established. DO NOT GUESS — must be resolved before 8.2 ingestion.
- **Microsoft Fluent Emoji**: Commit 62ecdc0d7ca5c6df32148c169556bc8d3782fca4 locked (2025-01-30). No semver release tag matched at audit time — commit SHA used instead of 'main'. Unicode version coverage for this commit not explicitly labeled.

---

*Phase 8.1 complete. Do not proceed to 8.2 automatically.*
