"use client";

import { useCallback, useId, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard/copy-text";

interface InvisibleCharCopyButtonProps {
  readonly content: string;
  readonly label: string;
  readonly className?: string;
}

export function InvisibleCharCopyButton({ content, label, className = "" }: InvisibleCharCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const dialogTitleId = useId();

  const handleCopy = useCallback(async () => {
    const ok = await copyText(content);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      return;
    }
    setShowFallback(true);
    window.setTimeout(() => {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }, 50);
  }, [content]);

  return (
    <>
      <button
        type="button"
        className={`btn btn--secondary btn--sm ${copied ? "btn--copied" : ""} ${className}`.trim()}
        onClick={() => void handleCopy()}
        aria-label={`Copy ${label}`}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>

      {showFallback ? (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setShowFallback(false)}
        >
          <div
            role="dialog"
            aria-labelledby={dialogTitleId}
            className="card-surface w-full max-w-md space-y-3 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={dialogTitleId} className="text-lg font-semibold">
              Copy manually
            </h2>
            <p className="text-sm text-muted">Clipboard access was blocked. Select the text below and copy.</p>
            <textarea
              ref={fallbackRef}
              readOnly
              value={content}
              className="w-full min-h-[4rem] rounded-lg border border-border bg-surface p-3 font-mono text-sm"
              aria-label={`${label} manual copy field`}
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowFallback(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
