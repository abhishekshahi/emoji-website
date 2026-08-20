# EmojiQuick R2 Canonical Export Audit (Phase 8.37)

## 1. Executive Summary

Read-only local canonical export built at `r2-export/`. No R2 upload. No master data modified. Frozen `release/8.10` untouched.

| Metric | Value |
|--------|------:|
| Canonical identities | 6,955 |
| Artwork records | 40,071 |
| Unique artwork binaries (SHA-256) | 39,652 |
| Duplicate binary record refs | 419 |
| R2 object count (planned) | 114,498 |
| Export size | 637,094,234 bytes (0.637 GB / 607.7 MiB / 0.593 GiB) |
| Build duration | ~305s |

**Verdict:** Local canonical export passes validation. Fits Cloudflare R2 Free (10 GB) with large safety margin. R2 account upload still blocked until R2 is enabled on the Cloudflare account.

---

## 2. Identity Preservation

| Check | Result |
|-------|--------|
| Input identities | 6,955 |
| Exported identities | 6,955 |
| Missing | 0 |
| Unexpected | 0 |
| Duplicate canonical IDs | 0 |

**Status: PASS**

Each identity exported as `identities/{canonicalId-sanitized}.json`.

---

## 3. Artwork Preservation

| Check | Result |
|-------|--------|
| Input artwork records | 40,071 |
| Exported artwork records | 40,071 |
| Missing records | 0 |
| Orphan records | 0 |

**Status: PASS**

Each record exported as `artwork-records/{sha256(filePath)}.json` with:
- Full source record fields preserved
- `recordObjectKey` — deterministic R2 key
- `binaryObjectKey` — deduplicated binary reference (`artwork/{sha256}.{ext}`)
- `publicServingClass` — license safety classification (A/B/C)

**Note:** `artworkId` is NOT unique across records (28,878 unique IDs, 3,731 collision groups). Multiple size variants share an `artworkId` but have unique `filePath` values. Export keys use `filePath` hash to preserve all 40,071 records.

---

## 4. Binary Deduplication

Independent SHA-256 verification confirms prior audit:

| Metric | Bytes | Notes |
|--------|------:|-------|
| Raw artwork storage | 404,662,287 | 40,071 files |
| Deduplicated storage | 402,325,604 | 39,652 unique binaries |
| Savings | 2,336,683 | 0.58% |
| Duplicate record refs | 419 | Records sharing identical binary |

Top duplicate pattern: OpenMoji ZWJ family variants sharing identical SVG binaries (21 files per group in several cases).

Sample duplicate groups: `manifests/binary-duplicate-groups.json` (top 50 groups).

**Mapping:** Each artwork record → `binaryObjectKey` pointing to one canonical `artwork/{sha256}.{ext}` object.

---

## 5. Provider Breakdown

| Provider | Artwork Records | Files | Public Class |
|----------|----------------:|------:|:------------:|
| OpenMoji | 4,495 | SVG/PNG | A |
| Noto | 19,673 | PNG (multi-size) | B |
| Twemoji | 8,018 | SVG/PNG | A |
| Fluent | 7,885 | PNG | C |
| **Total** | **40,071** | | |

---

## 6. License Matrix

Full matrix: `licenses/LICENSE-MATRIX.json`  
Human report: `licenses/LICENSE-REPORT.md`

| Provider | License | Storage | Public Serve | Commercial | Class |
|----------|---------|:-------:|:------------:|:----------:|:-----:|
| OpenMoji | CC BY-SA 4.0 | YES | YES (verified) | YES | A |
| Twemoji | CC BY 4.0 | YES | YES (verified) | YES | A |
| Noto (fonts) | SIL OFL 1.1 | YES | NO | conditional | B |
| Noto (images) | Apache 2.0 | YES | NO | YES | B |
| Fluent | MIT (repo) | YES | NO | conditional | C |
| Unicode/CLDR | Unicode ToU | YES | YES (data) | YES | A |
| Emojibase | MIT | YES | YES | YES | A |
| Emojilib | MIT | YES | YES | YES | A |
| EmojiNet | CC BY-NC-SA 4.0 | YES | NO (NC) | NO | C |

---

## 7. Public-Serving Classification

| Class | Meaning | Artwork Providers |
|-------|---------|-------------------|
| **A** | Safe to publicly serve (verified) | OpenMoji, Twemoji |
| **B** | Store; do not publicly serve yet | Noto |
| **C** | Unknown/restricted — hold | Fluent, EmojiNet |

**Default policy:** R2 bucket private. No public URLs without explicit per-provider gate.

---

## 8. Object Structure

```
r2-export/
├── identities/{canonicalId}.json           # 6,955
├── artwork/{sha256}.{ext}                # 39,652 (deduplicated binaries)
├── artwork-records/{sha256(filePath)}.json  # 40,071
├── metadata/{canonicalId}.json             # 6,955
├── semantic/{canonicalId}.json             # 6,955
├── search/{canonicalId}.json               # 6,955
├── provenance/{canonicalId}.json           # 6,955
├── licenses/
│   ├── LICENSE-MATRIX.json
│   └── LICENSE-REPORT.md
└── manifests/
    ├── master-manifest.json
    ├── r2-export-manifest.json
    ├── r2-checksums.sha256
    └── binary-duplicate-groups.json
```

Binaries linked via NTFS hard links from master `raw/artwork/` (no duplicate disk usage in local export).

---

## 9. Storage Comparison

| Option | Description | Bytes | GB (decimal) | GiB | Objects | R2 10GB % |
|--------|-------------|------:|-------------:|----:|--------:|----------:|
| A | Raw complete archive | 2,487,673,097 | 2.488 | 2.316 | 82,790 | 24.9% |
| B | Dedup artwork + metadata | 637,176,477 | 0.637 | 0.594 | 154,150 | 6.4% |
| C | **Canonical export (this build)** | **637,094,234** | **0.637** | **0.593** | **114,498** | **6.37%** |
| D | Canonical + gzip JSON est. | 554,978,671 | 0.555 | 0.517 | 114,498 | 5.55% |
| Ref | Existing `.r2-export/emojiquick` | 547,601,316 | 0.548 | 0.510 | 39,710 | 5.48% |

Combined prior plan (full archive + optimized): ~3.035 GB (30.35% of free tier).

---

## 10. R2 Free-Tier Calculation

| Metric | Value |
|--------|------:|
| R2 Free allowance | 10 GB (10,000,000,000 bytes) |
| Canonical export | 0.637 GB |
| Utilization | 6.37% |
| Remaining | 9.363 GB |

| Safety Margin | Max Size | Fits? |
|---------------|----------|:-----:|
| None (10 GB) | 10.000 GB | YES |
| 10% (9 GB) | 9.000 GB | YES |
| 20% (8 GB) | 8.000 GB | YES |
| 30% (7 GB) | 7.000 GB | YES |

---

## 11. Object Count

| Category | Count |
|----------|------:|
| Identity objects | 6,955 |
| Artwork binaries | 39,652 |
| Artwork record objects | 40,071 |
| Metadata objects | 6,955 |
| Semantic objects | 6,955 |
| Search objects | 6,955 |
| Provenance objects | 6,955 |
| License objects | 2 |
| Manifest objects | 2 |
| **Total R2 objects** | **114,498** |

Previous planned export (~122,506) included additional archive copies; optimized canonical structure reduces count while preserving all records.

---

## 12. Class A/B Operation Estimate

| Operation | Estimate | Notes |
|-----------|----------|-------|
| Class A (write) | 114,498 | One PUT per object on initial upload |
| Class B (read) | On-demand | Worker fetches individual objects at runtime |
| Monthly free Class A | 1,000,000 | Initial upload uses ~11.4% of monthly free tier |
| Monthly free Class B | 10,000,000 | Sufficient for moderate traffic |

**No upload performed in this phase.**

---

## 13. Worker Architecture

- Worker bundle remains ~2.48 MiB gzip (~83% of free tier limit)
- Full master dataset (2.488 GB) stored in R2, NOT bundled in Worker
- Worker reads from R2 via `MASTER_R2` binding (`emojiquick-master` bucket when enabled)
- Prefixes: `emojiquick/` (optimized) | `emojiquick-master/` (full archive)
- Client bundle and HTML payload unchanged

---

## 14. Production Safety

| Flag | Status |
|------|--------|
| MASTER_SEO_ROLLOUT_MODE | OFF |
| MASTER_R2_MODE | OFF |
| PUBLIC_MASTER_PLATFORM_MODE | OFF |
| masterSEOEnabled | false |
| masterArtworkEnabled | false |
| masterMetadataEnabled | false |
| masterSearchEnabled | false |
| CANARY | OFF |
| FULL | OFF |
| Production deploy | 0 |
| DNS changes | 0 |

---

## 15. Risks

1. **R2 not enabled** — Cloudflare account returns error 10042; no bucket exists yet.
2. **Noto/Fluent license ambiguity** — Stored safely (class B/C) but not cleared for public CDN serving.
3. **EmojiNet NC restriction** — Definitions cannot be bulk-redistributed commercially.
4. **Vendor extraction mirrors** — 35,576 exact binary duplicates between `raw/artwork/` and `raw/vendor/*/extracted/` (~418 MB); excluded from canonical export (archive copies only).
5. **OneDrive I/O** — Local hard links may not survive cross-volume copy; use manifest + checksum verification before remote upload.
6. **Hard link portability** — Re-upload tooling must read actual file bytes, not assume hard link targets exist on upload machine.

---

## 16. Recommended Next Step

1. Owner enables R2 on Cloudflare account.
2. Create `emojiquick-master` bucket (owner action only).
3. Run `npm run r2:check-account` to verify.
4. Controlled 10-object upload test with explicit YES confirmation.
5. Full upload of `r2-export/` using upload engine.
6. Run `npm run r2:verify-remote` against uploaded manifest.
7. Staging validation with `MASTER_R2_MODE=DATA_READY` (not production).
8. Do NOT enable `masterSEOEnabled`, `masterArtworkEnabled`, or SEO rollout until license and redirect audits complete.

**This audit authorizes local export readiness only. It does NOT authorize upload or production activation.**
