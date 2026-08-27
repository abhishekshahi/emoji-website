"use client";

import { useCallback, useId, useState } from "react";
import { useKaomojiPersonal } from "@/hooks/use-kaomoji-personal";
import { createPersonalCollection } from "@/lib/kaomoji/personal/client-store";
import type { PersonalSavePayload } from "@/lib/kaomoji/personal/types";
import { DEFAULT_FAVORITES_COLLECTION_ID } from "@/lib/kaomoji/personal/types";

interface KaomojiSaveButtonProps {
  payload: PersonalSavePayload;
  variant?: "icon" | "text" | "detail";
  size?: "sm" | "md" | "lg";
  className?: string;
  showCollectionPicker?: boolean;
}

export function KaomojiSaveButton({
  payload,
  variant = "icon",
  size = "sm",
  className = "",
  showCollectionPicker = false,
}: KaomojiSaveButtonProps) {
  const { store, isFavorite, toggleFavorite, saveItem } = useKaomojiPersonal();
  const saved = isFavorite(payload.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const menuId = useId();

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(payload);
    },
    [payload, toggleFavorite],
  );

  const handleSaveTo = useCallback(
    (collectionId: string) => {
      saveItem(collectionId, payload);
      setMenuOpen(false);
    },
    [payload, saveItem],
  );

  const handleCreateAndSave = useCallback(() => {
    const id = createPersonalCollection(newCollectionName);
    if (id) {
      saveItem(id, payload);
      setNewCollectionName("");
      setMenuOpen(false);
    }
  }, [newCollectionName, payload, saveItem]);

  const label = saved ? "Saved ✓" : "Save";
  const ariaLabel = saved ? `Remove ${payload.accessible_name} from favorites` : `Save ${payload.accessible_name}`;

  if (variant === "icon") {
    return (
      <button
        type="button"
        className={`btn btn--ghost btn--${size} min-h-9 ${saved ? "text-amber-500" : ""} ${className}`.trim()}
        onClick={handleToggle}
        aria-label={ariaLabel}
        aria-pressed={saved}
      >
        {saved ? "★" : "☆"}
      </button>
    );
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        className={`btn ${variant === "detail" ? "btn--secondary" : "btn--ghost"} btn--${size} min-h-9 ${saved ? "btn--copied" : ""}`}
        onClick={handleToggle}
        aria-label={ariaLabel}
        aria-pressed={saved}
      >
        {label}
      </button>
      {showCollectionPicker ? (
        <>
          <button
            type="button"
            className="btn btn--ghost btn--sm min-h-9 px-2"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label="Save to collection"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            ▾
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-background p-2 shadow-lg space-y-1"
              onClick={(e) => e.stopPropagation()}
            >
              {store.collections.map((col) => {
                const inCol = col.item_ids.includes(payload.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    role="menuitem"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                    onClick={() => handleSaveTo(col.id)}
                    disabled={inCol}
                  >
                    {col.name}
                    {inCol ? " ✓" : ""}
                    {col.id === DEFAULT_FAVORITES_COLLECTION_ID ? " (default)" : ""}
                  </button>
                );
              })}
              <div className="border-t border-border pt-2 mt-2 space-y-1">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection name"
                  maxLength={40}
                  className="w-full rounded-md border border-border px-2 py-1 text-sm"
                  aria-label="New collection name"
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm w-full"
                  disabled={!newCollectionName.trim()}
                  onClick={handleCreateAndSave}
                >
                  Create &amp; save
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
