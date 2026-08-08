"use client";

import { clearRecentHexcodes } from "@/lib/emoji/local-storage-store";

export function ClearRecentButton() {
  return (
    <button
      type="button"
      onClick={() => clearRecentHexcodes()}
      className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted"
    >
      Clear recent history
    </button>
  );
}
