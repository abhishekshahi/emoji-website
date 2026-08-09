import "server-only";

import type { BrowsableEmoji } from "@/lib/emoji/types";
import { getArtworkPath } from "@/lib/artwork/providers";
import { MASTER_INTEGRATION_CONFIG } from "@/lib/master/integration/config";
import type { UiArtworkProviderOption, UiMetadataPayload } from "@/lib/master/integration/ui/types";

function isUiEnabled(): boolean {
  return MASTER_INTEGRATION_CONFIG.masterArtworkEnabled || MASTER_INTEGRATION_CONFIG.masterMetadataEnabled;
}

async function loadMasterPanels() {
  return import("@/components/master/master-emoji-panels.server");
}

export async function renderMasterEmojiPanels(emoji: BrowsableEmoji) {
  if (!isUiEnabled()) {
    return null;
  }

  const { MasterEmojiPanelsServer } = await loadMasterPanels();
  return <MasterEmojiPanelsServer emoji={emoji} />;
}

export function getMasterPanelsFallbackArtwork(hexcode: string): string | null {
  return getArtworkPath(hexcode);
}

export type { UiArtworkProviderOption, UiMetadataPayload };
