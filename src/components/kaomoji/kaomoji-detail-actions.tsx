"use client";

import { useCallback } from "react";
import { KaomojiCopyButton } from "@/components/kaomoji/kaomoji-copy-button";
import { KaomojiSaveButton } from "@/components/kaomoji/kaomoji-save-button";
import { copyText } from "@/lib/clipboard/copy-text";
import { buildSavePayload } from "@/lib/kaomoji/personal/client-store";
import { trackKaomojiShare } from "@/lib/kaomoji/analytics/client";

interface Props {
  canonicalId: string;
  slug: string;
  content: string;
  accessibleName: string;
}

export function KaomojiDetailActions({ canonicalId, slug, content, accessibleName }: Props) {
  const savePayload = buildSavePayload({
    id: canonicalId,
    content,
    slug,
    accessible_name: accessibleName,
    source: "public",
  });

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/kaomoji/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: accessibleName, url });
        trackKaomojiShare(canonicalId, slug);
        return;
      } catch {
        /* fall through */
      }
    }
    if (await copyText(url)) trackKaomojiShare(canonicalId, slug);
  }, [accessibleName, canonicalId, slug]);

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <KaomojiCopyButton
        content={content}
        accessibleName={accessibleName}
        canonicalId={canonicalId}
        slug={slug}
        variant="primary"
        size="lg"
      />
      <KaomojiSaveButton payload={savePayload} variant="detail" size="lg" showCollectionPicker />
      <button type="button" className="btn btn--ghost min-h-11" onClick={() => void handleShare()}>
        Share
      </button>
    </div>
  );
}
