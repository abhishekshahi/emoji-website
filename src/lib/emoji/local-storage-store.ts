import {
  FAVORITES_STORAGE_KEY,
  MAX_RECENT_ITEMS,
  RECENT_STORAGE_KEY,
} from "@/lib/emoji/constants";
import { normalizeStoredHexcodes, resolveStoredHexcode } from "@/lib/emoji/storage-migration";

/** Stable empty snapshot shared by server rendering and initial hydration. */
export const SERVER_EMOJI_HEXCODES_SNAPSHOT: readonly string[] = [];

const STORAGE_EVENT = "emoji-storage";

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function readStorageRaw(key: string): string[] {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) {
      return [];
    }

    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStorage(key: string, value: string[]): void {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key } }));
}

export interface EmojiHexcodeStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => readonly string[];
  getServerSnapshot: () => readonly string[];
  setValue: (value: string[]) => void;
  getValue: () => readonly string[];
}

interface CreateEmojiHexcodeStoreOptions {
  maxItems?: number;
}

function migrateStorageIfNeeded(
  storageKey: string,
  maxItems?: number,
): void {
  const raw = readStorageRaw(storageKey);
  const normalized = normalizeStoredHexcodes(raw, maxItems);

  if (!arraysEqual(raw, normalized)) {
    writeStorage(storageKey, normalized);
  }
}

export function createEmojiHexcodeStore(
  storageKey: string,
  options: CreateEmojiHexcodeStoreOptions = {},
): EmojiHexcodeStore {
  const { maxItems } = options;
  let snapshot: readonly string[] = SERVER_EMOJI_HEXCODES_SNAPSHOT;
  const listeners = new Set<() => void>();

  const syncSnapshot = (): readonly string[] => {
    if (typeof window === "undefined") {
      return SERVER_EMOJI_HEXCODES_SNAPSHOT;
    }

    migrateStorageIfNeeded(storageKey, maxItems);

    const next = readStorageRaw(storageKey);
    if (arraysEqual(snapshot, next)) {
      return snapshot;
    }

    snapshot = next;
    return snapshot;
  };

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);

      const handleUpdate = (event: Event) => {
        if (event instanceof StorageEvent) {
          if (event.key !== storageKey && event.key !== null) {
            return;
          }
        } else if (event instanceof CustomEvent) {
          const detail = event.detail as { key?: string } | undefined;
          if (detail?.key && detail.key !== storageKey) {
            return;
          }
        }

        syncSnapshot();
        listener();
      };

      window.addEventListener(STORAGE_EVENT, handleUpdate);
      window.addEventListener("storage", handleUpdate);

      return () => {
        listeners.delete(listener);
        window.removeEventListener(STORAGE_EVENT, handleUpdate);
        window.removeEventListener("storage", handleUpdate);
      };
    },

    getSnapshot() {
      return syncSnapshot();
    },

    getServerSnapshot() {
      return SERVER_EMOJI_HEXCODES_SNAPSHOT;
    },

    setValue(value) {
      const normalized = normalizeStoredHexcodes(value, maxItems);
      if (arraysEqual(snapshot, normalized)) {
        return;
      }

      writeStorage(storageKey, normalized);
      snapshot = normalized;
      notify();
    },

    getValue() {
      return syncSnapshot();
    },
  };
}

export const favoritesStore = createEmojiHexcodeStore(FAVORITES_STORAGE_KEY);
export const recentStore = createEmojiHexcodeStore(RECENT_STORAGE_KEY, {
  maxItems: MAX_RECENT_ITEMS,
});

export function toggleFavoriteHexcode(hexcode: string): void {
  const resolved = resolveStoredHexcode(hexcode);
  if (!resolved) {
    return;
  }

  const current = [...favoritesStore.getValue()];
  const next = current.includes(resolved)
    ? current.filter((item) => item !== resolved)
    : [resolved, ...current];
  favoritesStore.setValue(next);
}

export function addRecentHexcode(hexcode: string): void {
  const resolved = resolveStoredHexcode(hexcode);
  if (!resolved) {
    return;
  }

  const current = recentStore.getValue();
  if (current[0] === resolved) {
    return;
  }

  const next = [resolved, ...current.filter((item) => item !== resolved)].slice(
    0,
    MAX_RECENT_ITEMS,
  );
  recentStore.setValue(next);
}

export function clearRecentHexcodes(): void {
  recentStore.setValue([]);
}
