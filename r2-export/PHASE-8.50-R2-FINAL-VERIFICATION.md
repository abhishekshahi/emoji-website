# Phase 8.50 — R2 Final Verification

Generated: 2026-08-13T02:28:41.637Z
Started: 2026-08-13T02:27:38.470Z
Elapsed: 63.1s

## Executive Result
**INCOMPLETE** (10/22 criteria met)

## Object Count
- Expected: 114498
- Remote: 10
- Missing: 114488
- Unexpected: 0
- Conflicts: 0

## Size Verification
- Size mismatches: 0

## Checksum Verification
- Verified: 10
- Checksum mismatches: 0
- Unable to verify: 0
- Retries: 0
- Throughput: 0.16/s

## Category Counts (remote)
- identities: 2
- metadata: 2
- semantic: 2
- search: 2
- provenance: 2
- artwork: 0
- artworkRecords: 0
- manifests: 0
- licenses: 0

## Identity Coverage
- 2 / 6955

## Artwork
- Records: 0 / 40071
- Unique binaries: 0 / 39652
- Duplicate refs (local): 419 / 419
- Artwork ID collisions: 11193
- SHA-256 key architecture: PASS

## Metadata / Semantic / Search / Provenance
- Metadata: 2 / 6955
- Semantic: 2 / 6955
- Search: 2 / 6955
- Provenance: 2 / 6955

## Security & Privacy
- Bucket: emojiquick-master
- Privacy: PRIVATE
- Public access: DISABLED

## Frozen Release 8.10
- 31/31 PASS

## Production HTTP
- https://emojiquick.com/ -> 200
- https://emojiquick.com/emoji/fire -> 200
- https://emojiquick.com/emoji/keycap -> 200
- https://emojiquick.com/category/smileys-emotion -> 200
- https://emojiquick.com/sitemap.xml -> 200
- https://emojiquick.com/robots.txt -> 200

## SEO / Rollout
- CANARY: OFF
- masterSEOEnabled: false
- masterArtworkEnabled: false

## Readiness Criteria
- objectCount: FAIL
- missingZero: FAIL
- unexpectedZero: PASS
- conflictsZero: PASS
- sizeMismatchesZero: PASS
- checksumsVerified: FAIL
- identities: FAIL
- artworkRecords: FAIL
- uniqueArtworkBinaries: FAIL
- duplicateBinaryRefs: PASS
- artworkIdCollisionsZero: FAIL
- metadata: FAIL
- semantic: FAIL
- search: FAIL
- provenance: FAIL
- r2Private: PASS
- productionFlagsOff: PASS
- canaryOff: PASS
- fullOff: PASS
- frozenIntegrity: PASS
- productionHttp: PASS
- localDataIntegrity: FAIL

## Final Decision: **INCOMPLETE**
