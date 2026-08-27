"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  buildSavePayload,
  isSavedInCollection,
  isSavedInFavorites,
  personalLibraryStore,
  saveToCollection,
  toggleFavoriteItem,
} from "@/lib/kaomoji/personal/client-store";
import type { PersonalSavePayload } from "@/lib/kaomoji/personal/types";
import { DEFAULT_FAVORITES_COLLECTION_ID } from "@/lib/kaomoji/personal/types";
import { trackKaomojiFavorite } from "@/lib/kaomoji/analytics/client";

export function useKaomojiPersonal() {
  const store = useSyncExternalStore(
    personalLibraryStore.subscribe,
    personalLibraryStore.getSnapshot,
    personalLibraryStore.getServerSnapshot,
  );

  const isFavorite = useCallback(
    (itemId: string) => isSavedInFavorites(store, itemId),
    [store],
  );

  const isSaved = useCallback(
    (itemId: string, collectionId = DEFAULT_FAVORITES_COLLECTION_ID) =>
      isSavedInCollection(store, itemId, collectionId),
    [store],
  );

  const toggleFavorite = useCallback((payload: PersonalSavePayload) => {
    const added = toggleFavoriteItem(payload);
    if (added && payload.source !== "generated") {
      trackKaomojiFavorite(payload.id, payload.slug ?? undefined);
    }
    return added;
  }, []);

  const saveItem = useCallback((collectionId: string, payload: PersonalSavePayload) => {
    const added = !isSavedInCollection(personalLibraryStore.getSnapshot(), collectionId, payload.id);
    saveToCollection(collectionId, payload);
    if (added && payload.source !== "generated") {
      trackKaomojiFavorite(payload.id, payload.slug ?? undefined);
    }
    return added;
  }, []);

  return {
    store,
    isFavorite,
    isSaved,
    toggleFavorite,
    saveItem,
    buildSavePayload,
  };
}
