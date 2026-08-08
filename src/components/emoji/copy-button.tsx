"use client";

import { useState } from "react";
import { useEmojiActions } from "@/components/providers/emoji-actions-provider";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard/copy-text";

interface CopyButtonProps {
  label: string;
  value: string;
  emojiId?: string;
  trackRecent?: boolean;
  toastMessage?: string;
  variant?: "primary" | "secondary";
  className?: string;
}

export function CopyButton({
  label,
  value,
  emojiId,
  trackRecent = false,
  toastMessage,
  variant = "secondary",
  className = "",
}: CopyButtonProps) {
  const { addRecent } = useEmojiActions();
  const { showToast } = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyText(value);

    if (!success) {
      showToast("Copy failed");
      return;
    }

    if (trackRecent && emojiId) {
      addRecent(emojiId);
    }

    setIsCopied(true);
    showToast(toastMessage ?? `Copied ${label}`);
    window.setTimeout(() => setIsCopied(false), 1600);
  };

  const baseClasses =
    variant === "primary"
      ? "rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong"
      : "rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-muted";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`min-h-11 ${baseClasses} ${className}`}
      aria-label={`Copy ${label}`}
    >
      {isCopied ? "Copied!" : label}
    </button>
  );
}
