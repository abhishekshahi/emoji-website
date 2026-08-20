# Phase 19 — Performance Hardening

**2026-08-20T18:17:13.398Z**

| Path | Status | ms | bytes | cache-control |
|------|--------|-----|-------|---------------|
| / | 200 | 1485 | 82723 | private, no-cache, no-store, max-age=0, must-revalidate |
| /kaomoji | 200 | 190 | 30974 | private, no-cache, no-store, max-age=0, must-revalidate |
| /api/kaomoji/search?q=anime&limit=10 | 200 | 185 | 14 | public, s-maxage=300, stale-while-revalidate=600 |
| /kaomoji/kao-00013e7cc777f411 | 200 | 269 | 40884 | s-maxage=31536000 |
| /kaomoji/collections/best-kaomoji | 200 | 179 | 208129 | s-maxage=31536000 |
| /api/kaomoji/search?q=%E7%8C%AB&limit=5 | 200 | 238 | 14 | public, s-maxage=300, stale-while-revalidate=600 |
| /api/kaomoji/search?limit=2&offset=0 | 200 | 194 | 14 | public, s-maxage=300, stale-while-revalidate=600 |
| /api/kaomoji/search?limit=2&offset=2 | 200 | 204 | 14 | public, s-maxage=300, stale-while-revalidate=600 |

**Avg cold:** 368ms · **Slowest:** 1485ms

Load: 3 concurrent (conservative). D1/R2 query counts: NOT VERIFIED at edge (no CF analytics token).
