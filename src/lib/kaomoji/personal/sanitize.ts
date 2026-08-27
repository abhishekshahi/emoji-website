import {
  MAX_COLLECTION_NAME_LENGTH,
  MAX_IMPORT_BYTES,
  MAX_ITEMS_PER_COLLECTION,
  MAX_KAOMOJI_CONTENT_LENGTH,
  MAX_PERSONAL_COLLECTIONS,
  MAX_TOTAL_PERSONAL_ITEMS,
} from "./limits";
import type { PersonalCollection, PersonalKaomojiItem, PersonalLibraryStore } from "./types";
import { PERSONAL_LIBRARY_VERSION } from "./types";

export const KAOMOJI_CANONICAL_ID_RE = /^kao_[a-f0-9]{16}$/;
export const PERSONAL_GENERATED_ID_RE = /^personal_[a-f0-9]{8,32}$/;

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

export function isValidPersonalItemId(id: string): boolean {
  return KAOMOJI_CANONICAL_ID_RE.test(id) || PERSONAL_GENERATED_ID_RE.test(id);
}

export function sanitizeCollectionName(raw: string): string | null {
  const trimmed = raw.normalize("NFC").trim().slice(0, MAX_COLLECTION_NAME_LENGTH);
  if (!trimmed || CONTROL_CHARS.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeKaomojiContent(raw: string): string | null {
  const normalized = raw.normalize("NFC").trim();
  if (!normalized || normalized.length > MAX_KAOMOJI_CONTENT_LENGTH) return null;
  if (CONTROL_CHARS.test(normalized)) return null;
  return normalized;
}

export function sanitizeAccessibleName(raw: string, fallback: string): string {
  const trimmed = raw.normalize("NFC").trim().slice(0, 120);
  if (!trimmed || CONTROL_CHARS.test(trimmed)) return fallback.slice(0, 120);
  return trimmed;
}

export function sanitizeSlug(raw: string | null | undefined): string | null {
  const slug = (raw ?? "").trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug.slice(0, 120);
}

function sanitizeItem(raw: unknown): PersonalKaomojiItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<PersonalKaomojiItem>;
  if (typeof item.id !== "string" || !isValidPersonalItemId(item.id)) return null;
  const content = sanitizeKaomojiContent(String(item.content ?? ""));
  if (!content) return null;
  const accessible_name = sanitizeAccessibleName(String(item.accessible_name ?? item.name ?? content), content);
  return {
    id: item.id,
    content,
    slug: sanitizeSlug(item.slug),
    name: item.name ? sanitizeAccessibleName(String(item.name), content) : null,
    accessible_name,
    source: item.source === "generated" ? "generated" : "public",
    saved_at: typeof item.saved_at === "string" ? item.saved_at : new Date().toISOString(),
  };
}

function sanitizeCollection(raw: unknown): PersonalCollection | null {
  if (!raw || typeof raw !== "object") return null;
  const col = raw as Partial<PersonalCollection>;
  if (typeof col.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,40}$/.test(col.id)) return null;
  const name = sanitizeCollectionName(String(col.name ?? ""));
  if (!name) return null;
  const item_ids = Array.isArray(col.item_ids)
    ? [...new Set(col.item_ids.filter((id): id is string => typeof id === "string" && isValidPersonalItemId(id)))]
    : [];
  return {
    id: col.id,
    name,
    created_at: typeof col.created_at === "string" ? col.created_at : new Date().toISOString(),
    updated_at: typeof col.updated_at === "string" ? col.updated_at : new Date().toISOString(),
    item_ids: item_ids.slice(0, MAX_ITEMS_PER_COLLECTION),
    ...(col.is_default ? { is_default: true } : {}),
  };
}

export function sanitizePersonalLibraryStore(raw: unknown): PersonalLibraryStore | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<PersonalLibraryStore>;
  if (data.version !== PERSONAL_LIBRARY_VERSION) return null;

  const items: Record<string, PersonalKaomojiItem> = {};
  if (data.items && typeof data.items === "object") {
    for (const [key, value] of Object.entries(data.items)) {
      const item = sanitizeItem(value);
      if (item && item.id === key) items[key] = item;
      if (Object.keys(items).length >= MAX_TOTAL_PERSONAL_ITEMS) break;
    }
  }

  const collections: PersonalCollection[] = [];
  if (Array.isArray(data.collections)) {
    for (const entry of data.collections) {
      const col = sanitizeCollection(entry);
      if (col) collections.push(col);
      if (collections.length >= MAX_PERSONAL_COLLECTIONS) break;
    }
  }

  return { version: PERSONAL_LIBRARY_VERSION, items, collections };
}

export function validateImportJson(text: string): { ok: true; store: PersonalLibraryStore } | { ok: false; reason: string } {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return { ok: false, reason: "import_too_large" };
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    const store = sanitizePersonalLibraryStore(parsed);
    if (!store) return { ok: false, reason: "invalid_structure" };
    return { ok: true, store };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
