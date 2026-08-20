# Phase 8.51 — FAST R2 Verification

Generated: 2026-08-13T19:38:14.397Z
Started: 2026-08-13T19:37:00.908Z
Elapsed: 73.5s

## Executive Result
**FAIL** (22/25 criteria met)

## Phase A — Remote List
- REST list count: 114491
- Cache: C:\Users\abhis\OneDrive\Desktop\emoji-website\r2-export\manifests\r2-phase-8-50-remote-list.json
- Remote total (after dot-key probe): 114501
- Conflicts: 0

## Phase B — Size Verification (list metadata + dot-keys)
- Canonical present: 114498 / 114498
- Missing: 0
- List size mismatches: 0
- Dot-keys probed: 10
- Dot-keys augmented: 10
- Dot-keys missing: 0

## Phase B2 — HEAD Sample
- Sample size: 200
- HEAD OK: 55
- HEAD failed: 145
- Size mismatches: 0
- Concurrency final: 64
- ETag samples: artwork/107829cc0d9b64665549b05e19880bafbeff5705a248f68ca08c38afceeec9ba.svg: W/"c199a86707219131f8bb3e91a5bdb692"; artwork/0787cdb9b8f56c020d4220f5d93befe312ced253a3f6f96cb4fa47df56a2708d.svg: W/"60c5854fe77ca7a4946b7c801c559f4a"; artwork/028965896dcfcbd47ed9104616eae15fe444100a4d364e69157eebf45f839f3e.png: "fa0b07418930b32fb57ef5fcc8a6b5e2"; artwork/3ec8a5b870b8c5d330e87a15950a695565580f0a0be8f3b051a6fc496c6d056b.png: "71485da5d268fbfe294e294ca9695eb2"; artwork/26508a76b952da9c971f4a83e970ebef216270376770a9f71856cb0eb2d9ed8a.svg: W/"f05c985baa351c3c414139e1537ff2ce"

## Phase C — Checksum Strategy
- R2 REST API does **not** provide server-side SHA-256 checksums
- ETag is **not** SHA-256 (opaque / MD5-style for single-part uploads)
- Full content SHA-256 on all 114,498 objects is **not** performed in FAST mode
- Spot-check SHA-256 downloads verify representative objects against r2-checksums.sha256

## Phase D — Spot Checks (SHA-256)
- Picked: 8
- Verified: 8
- Checksum mismatches: 0
- Size mismatches: 0
- Unable to verify: 0

## Phase E — Frozen Release 8.10
- 31/31 PASS

## Phase F — Production HTTP
- https://emojiquick.com/ -> 200
- https://emojiquick.com/emoji/fire -> 200
- https://emojiquick.com/emoji/keycap -> 200
- https://emojiquick.com/category/smileys-emotion -> 200
- https://emojiquick.com/sitemap.xml -> 200
- https://emojiquick.com/robots.txt -> 200

## Phase G — SEO / Rollout
- MASTER_SEO_ROLLOUT_MODE: OFF
- masterSEOEnabled: false
- masterArtworkEnabled: false
- masterMetadataEnabled: false
- masterSearchEnabled: false

## Phase H — R2 Privacy
- Bucket: emojiquick-master
- Privacy: PRIVATE

## Phase I — Category Counts (remote)
- identities: 6955
- metadata: 6955
- semantic: 6955
- search: 6955
- provenance: 6955
- artwork: 39652
- artworkRecords: 40071
- manifests: 1
- licenses: 1

## Unexpected Objects (expected 3)
- licenses/LICENSE-MATRIX.json
- manifests/master-manifest.json
- test-benchmark-delete-me.json
