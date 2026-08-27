"use client";

import {
  collectionCopyText,
  createCollection,
  deleteCollection,
  mergeImportedStore,
  readPersonalLibrary,
  removeItemFromCollection,
  renameCollection,
  saveItemToCollection,
  toggleFavorite,
  totalSavedCount,
  writePersonalLibrary,
} from "./storage";
import type { PersonalLibraryStore, PersonalSavePayload } from "./types";
import { DEFAULT_FAVORITES_COLLECTION_ID } from "./types";
import { validateImportJson } from "./sanitize";

const PERSONAL_EVENT = "kaomoji-personal-storage";

export const SERVER_PERSONAL_SNAPSHOT: PersonalLibraryStore = {
  version: 1,
  items: {},
  collections: [
    {
      id: DEFAULT_FAVORITES_COLLECTION_ID,
      name: "Favorites",
      created_at: "",
      updated_at: "",
      item_ids: [],
      is_default: true,
    },
  ],
};

const listeners = new Set<() => void>();
let snapshot: PersonalLibraryStore = SERVER_PERSONAL_SNAPSHOT;

function syncSnapshot(): PersonalLibraryStore {
  if (typeof window === "undefined") return SERVER_PERSONAL_SNAPSHOT;
  const next = readPersonalLibrary();
  snapshot = next;
  return snapshot;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function persist(next: PersonalLibraryStore): void {
  writePersonalLibrary(next);
  snapshot = next;
  notify();
}

export const personalLibraryStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);

    const handleUpdate = () => {
      syncSnapshot();
      listener();
    };

    window.addEventListener(PERSONAL_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      listeners.delete(listener);
      window.removeEventListener(PERSONAL_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  },

  getSnapshot(): PersonalLibraryStore {
    return syncSnapshot();
  },

  getServerSnapshot(): PersonalLibraryStore {
    return SERVER_PERSONAL_SNAPSHOT;
  },
};

export function createGeneratedPersonalId(): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `personal_${rand}`;
}

export function buildSavePayload(input: {
  id: string;
  content: string;
  slug?: string | null;
  name?: string | null;
  accessible_name: string;
  source?: "public" | "generated";
}): PersonalSavePayload {
  return {
    id: input.id,
    content: input.content,
    slug: input.slug ?? null,
    name: input.name ?? null,
    accessible_name: input.accessible_name,
    source: input.source ?? "public",
  };
}

export function isSavedInFavorites(store: PersonalLibraryStore, itemId: string): boolean {
  const fav = store.collections.find((c) => c.id === DEFAULT_FAVORITES_COLLECTION_ID);
  return fav?.item_ids.includes(itemId) ?? false;
}

export function isSavedInCollection(store: PersonalLibraryStore, collectionId: string, itemId: string): boolean {
  const col = store.collections.find((c) => c.id === collectionId);
  return col?.item_ids.includes(itemId) ?? false;
}

export function toggleFavoriteItem(payload: PersonalSavePayload): boolean {
  const store = personalLibraryStore.getSnapshot();
  const wasSaved = isSavedInFavorites(store, payload.id);
  const next = toggleFavorite(store, payload);
  persist(next);
  return !wasSaved;
}

export function saveToCollection(collectionId: string, payload: PersonalSavePayload): boolean {
  const store = personalLibraryStore.getSnapshot();
  const col = store.collections.find((c) => c.id === collectionId);
  if (!col) return false;
  if (col.item_ids.includes(payload.id)) return true;
  const next = saveItemToCollection(store, collectionId, payload);
  persist(next);
  return true;
}

export function removeFromCollection(collectionId: string, itemId: string): void {
  const store = personalLibraryStore.getSnapshot();
  const next = removeItemFromCollection(store, collectionId, itemId);
  persist(next);
}

export function createPersonalCollection(name: string): string | null {
  const store = personalLibraryStore.getSnapshot();
  const next = createCollection(store, name);
  if (!next) return null;
  const created = next.collections[next.collections.length - 1];
  persist(next);
  return created?.id ?? null;
}

export function renamePersonalCollection(collectionId: string, name: string): boolean {
  const store = personalLibraryStore.getSnapshot();
  const next = renameCollection(store, collectionId, name);
  if (!next) return false;
  persist(next);
  return true;
}

export function deletePersonalCollection(collectionId: string): boolean {
  const store = personalLibraryStore.getSnapshot();
  const next = deleteCollection(store, collectionId);
  if (!next) return false;
  persist(next);
  return true;
}

export function exportPersonalLibraryJson(): string {
  const store = personalLibraryStore.getSnapshot();
  return JSON.stringify(store, null, 2);
}

export function importPersonalLibraryJson(text: string): { ok: true } | { ok: false; reason: string } {
  const result = validateImportJson(text);
  if (!result.ok) return result;
  const merged = mergeImportedStore(personalLibraryStore.getSnapshot(), result.store);
  persist(merged);
  return { ok: true };
}

export function copyCollectionText(collectionId: string): string {
  return collectionCopyText(personalLibraryStore.getSnapshot(), collectionId);
}

export function getSavedCount(): number {
  return totalSavedCount(personalLibraryStore.getSnapshot());
}
