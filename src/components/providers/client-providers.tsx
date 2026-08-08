"use client";

import { EmojiActionsProvider } from "@/components/providers/emoji-actions-provider";
import { ToastProvider } from "@/components/ui/toast";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <EmojiActionsProvider>{children}</EmojiActionsProvider>
    </ToastProvider>
  );
}
