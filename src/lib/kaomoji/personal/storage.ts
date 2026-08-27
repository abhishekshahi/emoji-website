"use client";

import { KAOMOJI_FAVORITES_KEY, readKaomojiIds } from "../product/local-storage";
import {
  MAX_ITEMS_PER_COLLECTION,
  MAX_PERSONAL_COLLECTIONS,
  MAX_TOTAL_PERSONAL_ITEMS,
} from "./limits";
import { sanitizeCollectionName, sanitizePersonalLibraryStore } from "./sanitize";
import type {
  PersonalCollection,
  PersonalKaomojiItem,
  PersonalLibraryStore,
  PersonalSavePayload,
} from "./types";
import {
  DEFAULT_FAVORITES_COLLECTION_ID,
  PERSONAL_LIBRARY_STORAGE_KEY,
  PERSONAL_LIBRARY_VERSION,
} from "./types";

function emptyStore(): PersonalLibraryStore {
  const now = new Date().toISOString();
  return {
    version: PERSONAL_LIBRARY_VERSION,
    items: {},
    collections: [
      {
        id: DEFAULT_FAVORITES_COLLECTION_ID,
        name: "Favorites",
        created_at: now,
        updated_at: now,
        item_ids: [],
        is_default: true,
      },
    ],
  };
}

function emitChange(): void {
  window.dispatchEvent(new CustomEvent("kaomoji-personal-storage"));
}

export function readPersonalLibrary(): PersonalLibraryStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(PERSONAL_LIBRARY_STORAGE_KEY);
    if (!raw) {
      const migrated = migrateLegacyFavorites(emptyStore());
      writePersonalLibrary(migrated);
      return migrated;
    }
    const parsed = sanitizePersonalLibraryStore(JSON.parse(raw));
    if (!parsed) {
      const fresh = migrateLegacyFavorites(emptyStore());
      writePersonalLibrary(fresh);
      return fresh;
    }
    return ensureDefaultFavorites(parsed);
  } catch {
    return migrateLegacyFavorites(emptyStore());
  }
}

export function writePersonalLibrary(store: PersonalLibraryStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERSONAL_LIBRARY_STORAGE_KEY, JSON.stringify(store));
    emitChange();
  } catch {
    /* storage full — caller may surface message */
  }
}

function ensureDefaultFavorites(store: PersonalLibraryStore): PersonalLibraryStore {
  if (store.collections.some((c) => c.id === DEFAULT_FAVORITES_COLLECTION_ID)) return store;
  const now = new Date().toISOString();
  return {
    ...store,
    collections: [
      {
        id: DEFAULT_FAVORITES_COLLECTION_ID,
        name: "Favorites",
        created_at: now,
        updated_at: now,
        item_ids: [],
        is_default: true,
      },
      ...store.collections,
    ].slice(0, MAX_PERSONAL_COLLECTIONS),
  };
}

function migrateLegacyFavorites(store: PersonalLibraryStore): PersonalLibraryStore {
  const legacyIds = readKaomojiIds(KAOMOJI_FAVORITES_KEY);
  if (legacyIds.length === 0) return ensureDefaultFavorites(store);

  const now = new Date().toISOString();
  const items = { ...store.items };
  const favoritesIds: string[] = [];

  for (const id of legacyIds) {
    if (!/^kao_[a-f0-9]{16}$/.test(id)) continue;
    if (!items[id]) {
      items[id] = {
        id,
        content: "",
        slug: null,
        name: null,
        accessible_name: "Saved kaomoji",
        source: "public",
        saved_at: now,
      };
    }
    if (!favoritesIds.includes(id)) favoritesIds.push(id);
  }

  const base = ensureDefaultFavorites({ ...store, items });
  const collections = base.collections.map((c) =>
    c.id === DEFAULT_FAVORITES_COLLECTION_ID
      ? { ...c, item_ids: [...new Set([...favoritesIds, ...c.item_ids])].slice(0, MAX_ITEMS_PER_COLLECTION), updated_at: now }
      : c,
  );
  return { ...base, collections };
}

export function getDefaultFavoritesCollection(store: PersonalLibraryStore): PersonalCollection {
  return (
    store.collections.find((c) => c.id === DEFAULT_FAVORITES_COLLECTION_ID) ??
    store.collections[0]!
  );
}

export function isItemInCollection(store: PersonalLibraryStore, collectionId: string, itemId: string): boolean {
  const col = store.collections.find((c) => c.id === collectionId);
  return col?.item_ids.includes(itemId) ?? false;
}

export function isItemSavedAnywhere(store: PersonalLibraryStore, itemId: string): boolean {
  return store.collections.some((c) => c.item_ids.includes(itemId));
}

export function saveItemToCollection(
  store: PersonalLibraryStore,
  collectionId: string,
  payload: PersonalSavePayload,
): PersonalLibraryStore {
  if (Object.keys(store.items).length >= MAX_TOTAL_PERSONAL_ITEMS && !store.items[payload.id]) {
    return store;
  }

  const now = new Date().toISOString();
  const item: PersonalKaomojiItem = {
    id: payload.id,
    content: payload.content,
    slug: payload.slug ?? null,
    name: payload.name ?? null,
    accessible_name: payload.accessible_name,
    source: payload.source ?? "public",
    saved_at: now,
  };

  const items = { ...store.items, [payload.id]: item };
  const collections = store.collections.map((col) => {
    if (col.id !== collectionId) return col;
    if (col.item_ids.includes(payload.id)) return col;
    if (col.item_ids.length >= MAX_ITEMS_PER_COLLECTION) return col;
    return {
      ...col,
      item_ids: [payload.id, ...col.item_ids],
      updated_at: now,
    };
  });

  return { ...store, items, collections };
}

export function removeItemFromCollection(
  store: PersonalLibraryStore,
  collectionId: string,
  itemId: string,
): PersonalLibraryStore {
  const now = new Date().toISOString();
  const collections = store.collections.map((col) =>
    col.id === collectionId
      ? { ...col, item_ids: col.item_ids.filter((id) => id !== itemId), updated_at: now }
      : col,
  );
  return { ...store, collections };
}

export function toggleFavorite(store: PersonalLibraryStore, payload: PersonalSavePayload): PersonalLibraryStore {
  const fav = getDefaultFavoritesCollection(store);
  if (isItemInCollection(store, fav.id, payload.id)) {
    return removeItemFromCollection(store, fav.id, payload.id);
  }
  return saveItemToCollection(store, fav.id, payload);
}

export function createCollection(store: PersonalLibraryStore, name: string): PersonalLibraryStore | null {
  const sanitized = sanitizeCollectionName(name);
  if (!sanitized) return null;
  if (store.collections.length >= MAX_PERSONAL_COLLECTIONS) return null;
  const id = `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  return {
    ...store,
    collections: [
      ...store.collections,
      { id, name: sanitized, created_at: now, updated_at: now, item_ids: [] },
    ],
  };
}

export function renameCollection(store: PersonalLibraryStore, collectionId: string, name: string): PersonalLibraryStore | null {
  const sanitized = sanitizeCollectionName(name);
  if (!sanitized) return null;
  const target = store.collections.find((c) => c.id === collectionId);
  if (!target || target.is_default) return null;
  const now = new Date().toISOString();
  return {
    ...store,
    collections: store.collections.map((c) =>
      c.id === collectionId ? { ...c, name: sanitized, updated_at: now } : c,
    ),
  };
}

export function deleteCollection(store: PersonalLibraryStore, collectionId: string): PersonalLibraryStore | null {
  const target = store.collections.find((c) => c.id === collectionId);
  if (!target || target.is_default) return null;
  return {
    ...store,
    collections: store.collections.filter((c) => c.id !== collectionId),
  };
}

export function mergeImportedStore(current: PersonalLibraryStore, incoming: PersonalLibraryStore): PersonalLibraryStore {
  const items = { ...current.items, ...incoming.items };
  const itemKeys = Object.keys(items).slice(0, MAX_TOTAL_PERSONAL_ITEMS);
  const trimmedItems = Object.fromEntries(itemKeys.map((k) => [k, items[k]!]));

  const collections = [...current.collections];
  for (const col of incoming.collections) {
    if (col.is_default) continue;
    if (collections.length >= MAX_PERSONAL_COLLECTIONS) break;
    if (collections.some((c) => c.id === col.id)) continue;
    collections.push(col);
  }

  return sanitizePersonalLibraryStore({
    version: PERSONAL_LIBRARY_VERSION,
    items: trimmedItems,
    collections,
  }) ?? current;
}

export function collectionCopyText(store: PersonalLibraryStore, collectionId: string): string {
  const col = store.collections.find((c) => c.id === collectionId);
  if (!col) return "";
  return col.item_ids
    .map((id) => store.items[id]?.content ?? "")
    .filter(Boolean)
    .join("\n");
}

export function totalSavedCount(store: PersonalLibraryStore): number {
  const ids = new Set<string>();
  for (const col of store.collections) {
    for (const id of col.item_ids) ids.add(id);
  }
  return ids.size;
}
