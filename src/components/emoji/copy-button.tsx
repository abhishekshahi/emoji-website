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
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CopyButton({
  label,
  value,
  emojiId,
  trackRecent = false,
  toastMessage,
  variant = "secondary",
  size = "md",
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

  const variantClass =
    variant === "primary"
      ? "btn--primary"
      : variant === "ghost"
        ? "btn--ghost"
        : "btn--secondary";

  const ariaLabel = /^copy\b/i.test(label.trim()) ? label.trim() : `Copy ${label}`;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn ${variantClass} btn--${size} ${
        isCopied ? "btn--copied" : ""
      } ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {isCopied ? "Copied!" : label}
    </button>
  );
}
