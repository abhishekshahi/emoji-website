# Phase 20 Search

**Verdict:** PASS

Benchmark: **122/122**

- Rate limit: 120 req/min per IP
- Sanitization: control chars rejected, limit capped 48, offset capped 10000
- Cache: public s-maxage=300 stale-while-revalidate=600
- POST returns 405