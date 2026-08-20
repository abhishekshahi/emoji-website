# Phase 13 Cloudflare Readiness

Phase 19 migration plan (not deployed in Phase 13).

| Layer | Target | Est. size |
|-------|--------|-----------|
| Public kaomoji records | D1 | ~626.43 MB |
| Search index | KV or R2 | subset of public production |
| Relationships | D1 | from relationships.json |
| RAW / audit / excluded | R2 (private) | full processing size |
| Static tier manifests | R2 | tier id lists |

Do not migrate until Phase 19.