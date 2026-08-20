# Phase 19 Cost Model

Measured export sizes (local):

| Layer | Bytes |
|-------|------:|
| Public R2 | 8,62,89,713 |
| Rebuildable | 12,05,52,102 |
| Backup | 510 |
| **Total** | **20,68,42,325** |

D1: ~51k kaomoji + ~393k relationships — within D1 free tier for reads at moderate traffic.
R2: ~86 MB search index + manifests — minimal storage cost.
Workers: search served via existing OpenNext worker; no extra Worker count.