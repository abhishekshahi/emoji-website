import type { BrowsableEmoji } from "@/lib/emoji/types";
import { MASTER_INTEGRATION_CONFIG } from "@/lib/master/integration/config";

interface MasterEmojiPanelsGateProps {
  emoji: BrowsableEmoji;
}

const MASTER_UI_ENABLED =
  MASTER_INTEGRATION_CONFIG.masterArtworkEnabled || MASTER_INTEGRATION_CONFIG.masterMetadataEnabled;

export async function MasterEmojiPanelsGate({ emoji }: MasterEmojiPanelsGateProps) {
  if (!MASTER_UI_ENABLED) {
    return null;
  }

  const { MasterEmojiPanelsServer } = await import("@/components/master/master-emoji-panels.server");
  return <MasterEmojiPanelsServer emoji={emoji} />;
}
