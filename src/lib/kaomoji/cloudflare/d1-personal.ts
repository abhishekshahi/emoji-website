import "server-only";
import { D1_GET_KAOMOJI_PUBLIC_BY_ID } from "./d1-queries";
import { resolveKaomojiD1Binding } from "./d1-binding";
import { loadEditorialRecords } from "../product/loader";

export interface ResolvedPublicKaomoji {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly accessible_name: string;
  readonly editorial_name: string | null;
}

export async function resolvePublicKaomojiByIds(ids: readonly string[]): Promise<ResolvedPublicKaomoji[]> {
  const unique = [...new Set(ids)];
  const db = await resolveKaomojiD1Binding();

  if (db) {
    const items: ResolvedPublicKaomoji[] = [];
    for (const id of unique) {
      const row = await db.prepare(D1_GET_KAOMOJI_PUBLIC_BY_ID).bind(id).all<{
        canonical_id: string;
        slug: string;
        content: string;
        editorial_name: string | null;
        accessible_name: string;
      }>();
      const hit = row.results?.[0];
      if (!hit) continue;
      items.push({
        canonical_id: hit.canonical_id,
        slug: hit.slug,
        content: hit.content,
        editorial_name: hit.editorial_name,
        accessible_name: hit.accessible_name,
      });
    }
    return items;
  }

  const records = loadEditorialRecords();
  const byId = new Map(records.filter((r) => r.is_public).map((r) => [r.canonical_id, r]));
  return unique
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      canonical_id: r.canonical_id,
      slug: r.slug,
      content: r.canonical_content,
      editorial_name: r.editorial_name,
      accessible_name: r.accessible_name,
    }));
}
