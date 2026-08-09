import "server-only";

import type { BrowsableEmoji } from "@/lib/emoji/types";
import { loadMasterEmojiUiModel } from "@/lib/master/integration/ui/server-data";
import { MasterEmojiPanelsClient } from "@/components/master/master-emoji-panels-client";

interface MasterEmojiPanelsServerProps {
  emoji: BrowsableEmoji;
}

export function MasterEmojiPanelsServer({ emoji }: MasterEmojiPanelsServerProps) {
  const model = loadMasterEmojiUiModel(emoji);
  if (!model) {
    return null;
  }

  return <MasterEmojiPanelsClient model={model} />;
}
