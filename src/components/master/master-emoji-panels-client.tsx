"use client";

import type { MasterEmojiUiModel } from "@/lib/master/integration/ui/types";
import { ArtworkGallery } from "@/components/master/artwork/artwork-gallery";
import { CanonicalMetadataPanel } from "@/components/master/metadata/canonical-metadata-panel";
import { SourceMetadataPanel } from "@/components/master/metadata/source-metadata-panel";

interface MasterEmojiPanelsClientProps {
  model: MasterEmojiUiModel;
}

export function MasterEmojiPanelsClient({ model }: MasterEmojiPanelsClientProps) {
  return (
    <div className="space-y-6">
      {model.artworkProviders.length > 0 ? (
        <ArtworkGallery
          emoji={model.emoji}
          name={model.name}
          fallbackSrc={model.fallbackSrc}
          providers={model.artworkProviders}
        />
      ) : null}

      {model.metadata ? (
        <>
          <CanonicalMetadataPanel metadata={model.metadata} />
          <SourceMetadataPanel metadata={model.metadata} />
        </>
      ) : null}
    </div>
  );
}
