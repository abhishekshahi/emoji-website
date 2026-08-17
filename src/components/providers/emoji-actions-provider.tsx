"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard/copy-text";
import {
  addRecentHexcode,
  favoritesStore,
  recentStore,
  toggleFavoriteHexcode,
} from "@/lib/emoji/local-storage-store";

interface EmojiActionsContextValue {
  favorites: readonly string[];
  recent: readonly string[];
  copiedHexcode: string | null;
  isFavorite: (hexcode: string) => boolean;
  toggleFavorite: (hexcode: string) => void;
  addRecent: (hexcode: string) => void;
  copyEmoji: (hexcode: string, emoji: string) => Promise<boolean>;
}

const EmojiActionsContext = createContext<EmojiActionsContextValue | null>(null);

function useStoredHexcodes(store: typeof favoritesStore): readonly string[] {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

export function EmojiActionsProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const favorites = useStoredHexcodes(favoritesStore);
  const recent = useStoredHexcodes(recentStore);
  const [copiedHexcode, setCopiedHexcode] = useState<string | null>(null);

  const isFavorite = useCallback(
    (hexcode: string) => favorites.includes(hexcode),
    [favorites],
  );

  const toggleFavorite = useCallback((hexcode: string) => {
    toggleFavoriteHexcode(hexcode);
  }, []);

  const addRecent = useCallback((hexcode: string) => {
    addRecentHexcode(hexcode);
  }, []);

  const copyEmoji = useCallback(
    async (hexcode: string, emoji: string) => {
      const success = await copyText(emoji);

      if (!success) {
        showToast("Copy failed");
        return false;
      }

      setCopiedHexcode(hexcode);
      addRecentHexcode(hexcode);
      showToast("Copied! 🚀");
      window.setTimeout(() => {
        setCopiedHexcode((current) => (current === hexcode ? null : current));
      }, 1600);
      return true;
    },
    [showToast],
  );

  const value = useMemo(
    () => ({
      favorites,
      recent,
      copiedHexcode,
      isFavorite,
      toggleFavorite,
      addRecent,
      copyEmoji,
    }),
    [favorites, recent, copiedHexcode, isFavorite, toggleFavorite, addRecent, copyEmoji],
  );

  return (
    <EmojiActionsContext.Provider value={value}>
      {children}
    </EmojiActionsContext.Provider>
  );
}

export function useEmojiActions(): EmojiActionsContextValue {
  const context = useContext(EmojiActionsContext);

  if (!context) {
    throw new Error("useEmojiActions must be used within EmojiActionsProvider");
  }

  return context;
}
