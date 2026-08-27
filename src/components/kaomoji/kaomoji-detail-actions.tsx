"use client";

import { useCallback, useState } from "react";
import { copyText } from "@/lib/clipboard/copy-text";
import { addRecentKaomoji, toggleKaomojiFavorite, readKaomojiIds, KAOMOJI_FAVORITES_KEY } from "@/lib/kaomoji/product/local-storage";
import { trackKaomojiCopy, trackKaomojiFavorite, trackKaomojiShare } from "@/lib/kaomoji/analytics/client";

interface Props {
  canonicalId: string;
  slug: string;
  content: string;
  accessibleName: string;
}

export function KaomojiDetailActions({ canonicalId, slug, content, accessibleName }: Props) {
  const [copied, setCopied] = useState(false);
  const [fav, setFav] = useState(() =>
    typeof window !== "undefined" ? readKaomojiIds(KAOMOJI_FAVORITES_KEY).includes(canonicalId) : false,
  );

  const handleCopy = useCallback(async () => {
    if (await copyText(content)) {
      addRecentKaomoji(canonicalId);
      trackKaomojiCopy(canonicalId, slug);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }, [canonicalId, content, slug]);

  const handleFavorite = useCallback(() => {
    const next = toggleKaomojiFavorite(canonicalId);
    setFav(next);
    if (next) trackKaomojiFavorite(canonicalId, slug);
  }, [canonicalId, slug]);

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
      <button type="button" className="btn btn--primary btn--lg min-h-11" onClick={() => void handleCopy()} aria-label={`Copy ${accessibleName}`}>{copied ? "Copied!" : "Copy"}</button>
      <button type="button" className="btn btn--secondary min-h-11" onClick={handleFavorite} aria-label={fav ? "Unfavorite" : "Favorite"}>{fav ? "Favorited" : "Favorite"}</button>
      <button type="button" className="btn btn--ghost min-h-11" onClick={() => void handleShare()}>Share</button>
    </div>
  );
}
