# Phase 19 Cache

Cache-Control on kaomoji search API (public, max-age=60, stale-while-revalidate=300).
Detail/collection pages use Next.js incremental cache + regional cache (open-next.config.ts).
User-specific responses (favorites) not cached publicly.