"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KaomojiCopyButton } from "@/components/kaomoji/kaomoji-copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { useKaomojiPersonal } from "@/hooks/use-kaomoji-personal";
import {
  copyCollectionText,
  createPersonalCollection,
  deletePersonalCollection,
  exportPersonalLibraryJson,
  importPersonalLibraryJson,
  removeFromCollection,
  renamePersonalCollection,
} from "@/lib/kaomoji/personal/client-store";
import { copyText } from "@/lib/clipboard/copy-text";
import type { PersonalCollection, PersonalKaomojiItem } from "@/lib/kaomoji/personal/types";
import { DEFAULT_FAVORITES_COLLECTION_ID } from "@/lib/kaomoji/personal/types";

interface ResolvedPublicItem {
  canonical_id: string;
  slug: string;
  content: string;
  accessible_name: string;
  editorial_name: string | null;
}

function displayItem(item: PersonalKaomojiItem, resolved?: ResolvedPublicItem): PersonalKaomojiItem {
  if (!resolved || item.source === "generated") return item;
  return {
    ...item,
    content: resolved.content || item.content,
    slug: resolved.slug || item.slug,
    name: resolved.editorial_name ?? item.name,
    accessible_name: resolved.accessible_name || item.accessible_name,
  };
}

export function KaomojiPersonalLibrary() {
  const { store } = useKaomojiPersonal();
  const [activeCollectionId, setActiveCollectionId] = useState<string>(DEFAULT_FAVORITES_COLLECTION_ID);
  const [resolved, setResolved] = useState<Record<string, ResolvedPublicItem>>({});
  const [loadingResolve, setLoadingResolve] = useState(false);
  const [renameTarget, setRenameTarget] = useState<PersonalCollection | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createValue, setCreateValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const activeCollection = store.collections.find((c) => c.id === activeCollectionId) ?? store.collections[0]!;

  const publicIds = useMemo(
    () =>
      activeCollection.item_ids.filter(
        (id) => id.startsWith("kao_") && store.items[id]?.source !== "generated",
      ),
    [activeCollection.item_ids, store.items],
  );

  useEffect(() => {
    if (publicIds.length === 0) {
      setResolved({});
      return;
    }
    let cancelled = false;
    setLoadingResolve(true);
    void fetch("/api/kaomoji/personal/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: publicIds.slice(0, 100) }),
    })
      .then((r) => r.json())
      .then((data: { items?: ResolvedPublicItem[] }) => {
        if (cancelled) return;
        const map: Record<string, ResolvedPublicItem> = {};
        for (const item of data.items ?? []) map[item.canonical_id] = item;
        setResolved(map);
      })
      .catch(() => {
        if (!cancelled) setResolved({});
      })
      .finally(() => {
        if (!cancelled) setLoadingResolve(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicIds.join(",")]);

  const activeItems = useMemo(
    () =>
      activeCollection.item_ids
        .map((id) => store.items[id])
        .filter((item): item is PersonalKaomojiItem => Boolean(item))
        .map((item) => displayItem(item, resolved[item.id])),
    [activeCollection.item_ids, store.items, resolved],
  );

  const totalUnique = useMemo(() => {
    const ids = new Set<string>();
    for (const col of store.collections) for (const id of col.item_ids) ids.add(id);
    return ids.size;
  }, [store.collections]);

  const flash = useCallback((msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(null), 2000);
  }, []);

  const handleCopyAll = useCallback(async () => {
    const text = copyCollectionText(activeCollection.id);
    if (!text) return;
    const ok = await copyText(text);
    flash(ok ? "Copied all ✓" : "Copy failed — try individual items");
  }, [activeCollection.id, flash]);

  const handleExport = useCallback(() => {
    const blob = new Blob([exportPersonalLibraryJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "emojiquick-kaomoji-collections.json";
    a.click();
    URL.revokeObjectURL(url);
    flash("Exported locally");
  }, [flash]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        const result = importPersonalLibraryJson(text);
        if (!result.ok) {
          setImportError(result.reason);
          return;
        }
        setImportError(null);
        flash("Import complete");
      });
      e.target.value = "";
    },
    [flash],
  );

  const handleCreate = useCallback(() => {
    const id = createPersonalCollection(createValue);
    if (id) {
      setCreateValue("");
      setCreateOpen(false);
      setActiveCollectionId(id);
      flash("Collection created");
    }
  }, [createValue, flash]);

  const handleRename = useCallback(() => {
    if (!renameTarget) return;
    if (renamePersonalCollection(renameTarget.id, renameValue)) {
      setRenameTarget(null);
      setRenameValue("");
      flash("Renamed");
    }
  }, [renameTarget, renameValue, flash]);

  const handleDelete = useCallback(
    (col: PersonalCollection) => {
      if (col.is_default) return;
      if (!window.confirm(`Delete collection "${col.name}"? Items stay in other collections.`)) return;
      if (deletePersonalCollection(col.id)) {
        if (activeCollectionId === col.id) setActiveCollectionId(DEFAULT_FAVORITES_COLLECTION_ID);
        flash("Collection deleted");
      }
    },
    [activeCollectionId, flash],
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted rounded-lg border border-border bg-muted/20 px-3 py-2">
        Saved locally in your browser — no account required. Personal collections are not uploaded or indexed.
      </p>

      {statusMsg ? (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400" role="status">
          {statusMsg}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{totalUnique} saved kaomoji</span>
        <span aria-hidden="true">·</span>
        <span>{store.collections.length} collections</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setCreateOpen(true)}>
          Create collection
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => void handleCopyAll()} disabled={!activeItems.length}>
          Copy all
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={handleExport}>
          Export JSON
        </button>
        <label className="btn btn--ghost btn--sm cursor-pointer">
          Import JSON
          <input type="file" accept="application/json,.json" className="sr-only" onChange={handleImport} />
        </label>
      </div>

      {importError ? <p className="text-sm text-red-600">Import failed: {importError}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {store.collections.map((col) => (
          <button
            key={col.id}
            type="button"
            className={`rounded-xl border p-3 text-left transition-colors ${
              col.id === activeCollectionId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
            }`}
            onClick={() => setActiveCollectionId(col.id)}
          >
            <div className="font-medium truncate">{col.name}</div>
            <div className="text-xs text-muted mt-1">
              {col.item_ids.length} items
              {col.is_default ? " · default" : ""}
            </div>
          </button>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{activeCollection.name}</h2>
          {!activeCollection.is_default ? (
            <div className="flex gap-1">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setRenameTarget(activeCollection);
                  setRenameValue(activeCollection.name);
                }}
              >
                Rename
              </button>
              <button type="button" className="btn btn--ghost btn--sm text-red-600" onClick={() => handleDelete(activeCollection)}>
                Delete
              </button>
            </div>
          ) : null}
        </div>

        {loadingResolve ? <p className="text-sm text-muted">Loading saved items…</p> : null}

        {activeItems.length === 0 ? (
          <EmptyState
            title="No saved kaomoji yet"
            description="Tap Save on any kaomoji card or detail page to add it here."
          >
            <Link href="/kaomoji" className="btn btn--primary btn--md">
              Browse kaomoji
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeItems.map((item) => (
              <li key={item.id} className="rounded-xl border border-border p-3 space-y-2">
                {item.slug && item.source === "public" ? (
                  <Link href={`/kaomoji/${item.slug}`} className="block text-center text-2xl break-all hover:opacity-80">
                    {item.content}
                  </Link>
                ) : (
                  <div className="text-center text-2xl break-all">{item.content}</div>
                )}
                {item.source === "generated" ? (
                  <p className="text-[11px] text-muted text-center">Generated · personal only</p>
                ) : null}
                <div className="flex justify-center gap-1">
                  <KaomojiCopyButton
                    content={item.content}
                    accessibleName={item.accessible_name}
                    canonicalId={item.source === "public" ? item.id : undefined}
                    slug={item.slug ?? undefined}
                    size="sm"
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      removeFromCollection(activeCollection.id, item.id);
                      flash("Removed");
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {createOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={() => setCreateOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Create collection" className="w-full max-w-sm rounded-xl border border-border bg-background p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Create collection</h3>
            <input
              type="text"
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              maxLength={40}
              placeholder="My Favorites, Cute, Love…"
              className="w-full rounded-lg border border-border px-3 py-2"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="button" className="btn btn--primary btn--sm" disabled={!createValue.trim()} onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      ) : null}

      {renameTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={() => setRenameTarget(null)}>
          <div role="dialog" aria-modal="true" aria-label="Rename collection" className="w-full max-w-sm rounded-xl border border-border bg-background p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Rename collection</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={40}
              className="w-full rounded-lg border border-border px-3 py-2"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button type="button" className="btn btn--primary btn--sm" disabled={!renameValue.trim()} onClick={handleRename}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
