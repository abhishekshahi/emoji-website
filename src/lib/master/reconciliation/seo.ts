import type { CanonicalNameRecord } from "./types";
import type { CanonicalKeywordEntry } from "./types";
import type { CanonicalSeoRecord, SeoConflictEntry } from "./types";
import { disambiguatedSlug, normalizeForComparison, slugifyName } from "./normalize";

const OVERLY_BROAD_KEYWORDS = new Set(["emoji", "symbol", "face", "hand", "flag", "tool"]);
const UNSAFE_KEYWORD_PATTERNS = [/https?:\/\//i, /emojipedia/i, /www\./i];

export function buildSeoRecord(
  nameRecord: CanonicalNameRecord,
  keywordEntry: CanonicalKeywordEntry,
): CanonicalSeoRecord {
  const slug = slugifyName(nameRecord.canonicalName);
  const aliases = nameRecord.aliases.map((alias) => alias.value);
  const keywords = keywordEntry.normalizedKeywords.slice(0, 25);

  return {
    canonicalId: nameRecord.canonicalId,
    canonicalName: nameRecord.canonicalName,
    slug,
    seoTitle: nameRecord.canonicalName,
    seoDescription: `Explore ${nameRecord.canonicalName} emoji details, aliases, keywords, and source metadata.`,
    aliases,
    keywords,
    disambiguated: false,
    disambiguationReason: null,
  };
}

export function resolveSeoSlugCollisions(records: CanonicalSeoRecord[]): CanonicalSeoRecord[] {
  const slugOwners = new Map<string, CanonicalSeoRecord[]>();

  for (const record of records) {
    const owners = slugOwners.get(record.slug) ?? [];
    owners.push(record);
    slugOwners.set(record.slug, owners);
  }

  return records.map((record) => {
    const owners = slugOwners.get(record.slug) ?? [record];
    if (owners.length === 1) {
      return record;
    }

    const sortedOwners = [...owners].sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
    if (sortedOwners[0].canonicalId === record.canonicalId) {
      return record;
    }

    return {
      ...record,
      slug: disambiguatedSlug(record.slug, record.canonicalId),
      disambiguated: true,
      disambiguationReason: `slug-collision:${record.slug}`,
    };
  });
}

export function buildSeoConflicts(
  seoRecords: CanonicalSeoRecord[],
  nameRecords: CanonicalNameRecord[],
): SeoConflictEntry[] {
  const conflicts: SeoConflictEntry[] = [];
  const slugMap = new Map<string, string[]>();
  const nameMap = new Map<string, string[]>();
  const aliasMap = new Map<string, string[]>();

  for (const record of seoRecords) {
    const slugIds = slugMap.get(record.slug) ?? [];
    slugIds.push(record.canonicalId);
    slugMap.set(record.slug, slugIds);

    const nameKey = normalizeForComparison(record.canonicalName);
    const nameIds = nameMap.get(nameKey) ?? [];
    nameIds.push(record.canonicalId);
    nameMap.set(nameKey, nameIds);

    for (const alias of record.aliases) {
      const aliasKey = normalizeForComparison(alias);
      const aliasIds = aliasMap.get(aliasKey) ?? [];
      aliasIds.push(record.canonicalId);
      aliasMap.set(aliasKey, aliasIds);
    }
  }

  for (const [slug, ids] of slugMap.entries()) {
    if (ids.length > 1) {
      conflicts.push({
        kind: "duplicate-slug",
        canonicalId: ids[0],
        value: slug,
        relatedCanonicalIds: ids,
        detail: "Multiple canonical identities share the same base slug before disambiguation.",
      });
    }
  }

  for (const [name, ids] of nameMap.entries()) {
    if (ids.length > 1) {
      conflicts.push({
        kind: "duplicate-canonical-name",
        canonicalId: ids[0],
        value: name,
        relatedCanonicalIds: ids,
        detail: "Multiple canonical identities resolved to the same canonical display name.",
      });
    }
  }

  for (const [alias, ids] of aliasMap.entries()) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length > 1) {
      conflicts.push({
        kind: "ambiguous-alias",
        canonicalId: uniqueIds[0],
        value: alias,
        relatedCanonicalIds: uniqueIds,
        detail: "Alias value appears on multiple canonical identities.",
      });
    }
  }

  for (const record of seoRecords) {
    for (const keyword of record.keywords) {
      if (UNSAFE_KEYWORD_PATTERNS.some((pattern) => pattern.test(keyword))) {
        conflicts.push({
          kind: "unsafe-keyword",
          canonicalId: record.canonicalId,
          value: keyword,
          relatedCanonicalIds: [record.canonicalId],
          detail: "Keyword contains URL or external reference material.",
        });
      }
      if (OVERLY_BROAD_KEYWORDS.has(keyword)) {
        conflicts.push({
          kind: "overly-broad-keyword",
          canonicalId: record.canonicalId,
          value: keyword,
          relatedCanonicalIds: [record.canonicalId],
          detail: "Keyword is overly broad for SEO targeting.",
        });
      }
    }
  }

  for (const record of nameRecords) {
    if (record.conflictCategory === "source-specific-naming" || record.conflictCategory === "semantic-difference") {
      conflicts.push({
        kind: "source-specific-naming-conflict",
        canonicalId: record.canonicalId,
        value: record.canonicalName,
        relatedCanonicalIds: [record.canonicalId],
        detail: `Unresolved source naming tension: ${record.conflictCategory}`,
      });
    }
  }

  return conflicts.sort((left, right) =>
    `${left.kind}:${left.canonicalId}`.localeCompare(`${right.kind}:${right.canonicalId}`),
  );
}
