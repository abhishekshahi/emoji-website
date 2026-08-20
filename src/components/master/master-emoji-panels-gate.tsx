import type { BrowsableEmoji } from "@/lib/emoji/types";
import { MASTER_INTEGRATION_CONFIG } from "@/lib/master/integration/config";
import { shouldReadFromR2Binding } from "@/lib/master/r2/config";

interface MasterEmojiPanelsGateProps {
  emoji: BrowsableEmoji;
}

const MASTER_UI_ENABLED =
  MASTER_INTEGRATION_CONFIG.masterArtworkEnabled || MASTER_INTEGRATION_CONFIG.masterMetadataEnabled;

export async function MasterEmojiPanelsGate({ emoji }: MasterEmojiPanelsGateProps) {
  if (!MASTER_UI_ENABLED) {
    return null;
  }

  // Production edge (MASTER_R2_MODE=ENABLED) has no local r2-export or frozen artwork FS.
  // Master metadata/artwork is served via /api/master/* using the MASTER_R2 binding.
  if (shouldReadFromR2Binding()) {
    return null;
  }

  const { MasterEmojiPanelsServer } = await import("@/components/master/master-emoji-panels.server");
  return <MasterEmojiPanelsServer emoji={emoji} />;
}
