#!/usr/bin/env npx tsx
import { getPlatformProxy } from "wrangler";

async function main() {
  const { env } = await getPlatformProxy({ configPath: "wrangler.jsonc" });
  const db = (env as { KAOMOJI_D1?: { prepare(q: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }> } } } }).KAOMOJI_D1;
  if (!db) {
    console.log("NO_D1_BINDING");
    return;
  }
  const sql = `
    SELECT k.slug FROM kaomoji_keyword kk
    INNER JOIN kaomoji k ON k.canonical_id = kk.canonical_id
    WHERE k.is_public = 1 AND kk.keyword = ?1
    ORDER BY k.quality_score DESC LIMIT ?2
  `;
  for (const token of ["cat", "japanese", "anime"]) {
    const r = await db.prepare(sql).bind(token, 5).all<{ slug: string }>();
    console.log(`${token}=${r.results?.length ?? 0}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
