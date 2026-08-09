"use client";

import { EmojiActionsProvider } from "@/components/providers/emoji-actions-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <EmojiActionsProvider>{children}</EmojiActionsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
