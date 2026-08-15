# Phase 8.57-D Search Performance

Status: PASS WITH WARNINGS
Fix: removed N+1 adapter.getSearch in searchPublicMasterFromR2 production loop

| Query | Before (ms) | After (ms) |
|-------|-------------|------------|
| heart | 10823 | 5978 |
| fire | 6136 | 6499 |
| love | 5457 | 7417 |
| family | 5447 | 6128 |
| doctor | 3399 | 3566 |
| birthday | 788 | 919 |

Version: 1a076681-db4f-46f4-a84d-822720635e01
