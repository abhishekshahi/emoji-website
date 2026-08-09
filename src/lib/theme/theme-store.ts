"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme/constants";
import {
  applyThemeToDocument,
  cycleThemePreference,
  readStoredThemePreference,
  resolveTheme,
} from "@/lib/theme/resolve-theme";

export interface ThemeSnapshot {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

const DEFAULT_SNAPSHOT: ThemeSnapshot = {
  preference: DEFAULT_THEME_PREFERENCE,
  resolved: "light",
};

let currentSnapshot: ThemeSnapshot = DEFAULT_SNAPSHOT;

const listeners = new Set<() => void>();

let storeInitialized = false;
let systemMediaQuery: MediaQueryList | null = null;

function getThemeSnapshot(): ThemeSnapshot {
  return currentSnapshot;
}

function getServerThemeSnapshot(): ThemeSnapshot {
  return DEFAULT_SNAPSHOT;
}

function notifyThemeListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function updateThemeSnapshot(
  preference: ThemePreference,
  resolved: ResolvedTheme,
): void {
  if (
    currentSnapshot.preference === preference &&
    currentSnapshot.resolved === resolved
  ) {
    return;
  }

  currentSnapshot = { preference, resolved };
  notifyThemeListeners();
}

function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function handleSystemThemeChange(): void {
  if (currentSnapshot.preference !== "system") {
    return;
  }

  const resolved = resolveTheme("system");
  updateThemeSnapshot("system", resolved);
}

function attachSystemThemeListener(): void {
  if (typeof window === "undefined") {
    return;
  }

  detachSystemThemeListener();

  if (currentSnapshot.preference !== "system") {
    return;
  }

  systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  systemMediaQuery.addEventListener("change", handleSystemThemeChange);
}

function detachSystemThemeListener(): void {
  if (!systemMediaQuery) {
    return;
  }

  systemMediaQuery.removeEventListener("change", handleSystemThemeChange);
  systemMediaQuery = null;
}

function syncSnapshotFromStorage(): void {
  const preference = readStoredThemePreference();
  const resolved = resolveTheme(preference);
  updateThemeSnapshot(preference, resolved);
}

function initializeThemeStore(): void {
  if (storeInitialized) {
    return;
  }

  storeInitialized = true;
  syncSnapshotFromStorage();
  attachSystemThemeListener();
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage access errors.
  }

  const resolved = resolveTheme(preference);
  updateThemeSnapshot(preference, resolved);
  attachSystemThemeListener();
}

export function useThemeSnapshot(): ThemeSnapshot {
  const snapshot = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    initializeThemeStore();
  }, []);

  useEffect(() => {
    applyThemeToDocument(snapshot.preference, snapshot.resolved);

    if (snapshot.preference === "system") {
      attachSystemThemeListener();
      return detachSystemThemeListener;
    }

    detachSystemThemeListener();
    return undefined;
  }, [snapshot.preference, snapshot.resolved]);

  return snapshot;
}

export function useThemeActions() {
  const snapshot = useThemeSnapshot();

  const setPreference = useCallback((preference: ThemePreference) => {
    writeThemePreference(preference);
  }, []);

  const cyclePreference = useCallback(() => {
    writeThemePreference(cycleThemePreference(snapshot.preference));
  }, [snapshot.preference]);

  return {
    ...snapshot,
    setPreference,
    cyclePreference,
  };
}
