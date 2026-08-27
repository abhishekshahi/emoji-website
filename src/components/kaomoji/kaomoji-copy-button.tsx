"use client";

import { useCallback, useId, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard/copy-text";
import { addRecentKaomoji } from "@/lib/kaomoji/product/local-storage";
import { trackKaomojiCopy } from "@/lib/kaomoji/analytics/client";

interface KaomojiCopyButtonProps {
  content: string;
  accessibleName: string;
  canonicalId?: string;
  slug?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  trackRecent?: boolean;
}

export function KaomojiCopyButton({
  content,
  accessibleName,
  canonicalId,
  slug,
  variant = "secondary",
  size = "sm",
  className = "",
  trackRecent = true,
}: KaomojiCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const dialogTitleId = useId();

  const variantClass =
    variant === "primary" ? "btn--primary" : variant === "ghost" ? "btn--ghost" : "btn--secondary";

  const handleCopy = useCallback(async () => {
    const ok = await copyText(content);
    if (ok) {
      if (trackRecent && canonicalId) addRecentKaomoji(canonicalId);
      if (canonicalId) trackKaomojiCopy(canonicalId, slug);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      return;
    }
    setShowFallback(true);
    window.setTimeout(() => {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }, 50);
  }, [content, canonicalId, slug, trackRecent]);

  const closeFallback = useCallback(() => setShowFallback(false), []);

  return (
    <>
      <button
        type="button"
        className={`btn ${variantClass} btn--${size} ${copied ? "btn--copied" : ""} ${className}`.trim()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleCopy();
        }}
        aria-label={`Copy ${accessibleName}`}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>

      {showFallback ? (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={closeFallback}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeFallback();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-md rounded-xl border border-border bg-background p-4 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={dialogTitleId} className="text-base font-semibold">
              Select &amp; copy
            </h2>
            <p className="text-sm text-muted">
              Clipboard access was blocked. Select the kaomoji below and copy manually.
            </p>
            <textarea
              ref={fallbackRef}
              readOnly
              value={content}
              className="w-full min-h-[4rem] rounded-lg border border-border bg-muted/30 p-3 text-lg text-center font-mono resize-none"
              aria-label={`Kaomoji text for ${accessibleName}`}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn--secondary btn--sm" onClick={closeFallback}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
