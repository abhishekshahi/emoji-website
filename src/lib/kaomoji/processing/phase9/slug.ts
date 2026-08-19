export function canonicalIdToSlug(canonicalId: string): string {
  return canonicalId.replace(/^kao_/, "kao-");
}

export function slugToCanonicalId(slug: string): string {
  if (slug.startsWith("kao-")) return `kao_${slug.slice(4)}`;
  if (slug.startsWith("kao_")) return slug;
  return `kao_${slug}`;
}

const SLUG_RE = /^kao-[a-f0-9]{16}$/;

export function isValidKaomojiSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}
