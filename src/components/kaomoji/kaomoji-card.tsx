"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { copyText } from "@/lib/clipboard/copy-text";
import { addRecentKaomoji, toggleKaomojiFavorite, readKaomojiIds, KAOMOJI_FAVORITES_KEY } from "@/lib/kaomoji/product/local-storage";

export interface KaomojiCardData {
  canonical_id: string;
  slug: string;
  content: string;
  name: string | null;
  accessible_name: string;
}

interface KaomojiCardProps {
  item: KaomojiCardData;
}

export function KaomojiCard({ item }: KaomojiCardProps) {
  const [copied, setCopied] = useState(false);
  const [fav, setFav] = useState(() =>
    typeof window !== "undefined" ? readKaomojiIds(KAOMOJI_FAVORITES_KEY).includes(item.canonical_id) : false,
  );

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(item.content);
    if (ok) {
      addRecentKaomoji(item.canonical_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }, [item.canonical_id, item.content]);

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFav(toggleKaomojiFavorite(item.canonical_id));
  }, [item.canonical_id]);

  return (
    <article className="emoji-card group p-2 sm:p-3">
      <Link href={`/kaomoji/${item.slug}`} className="block space-y-2 text-center" aria-label={item.accessible_name}>
        <div className="text-2xl sm:text-3xl leading-none break-all px-1" aria-hidden="true">{item.content}</div>
        {item.name ? <p className="text-xs text-muted truncate">{item.name}</p> : null}
      </Link>
      <div className="mt-2 flex gap-1 justify-center">
        <button type="button" className="btn btn--secondary btn--sm min-h-9" onClick={handleCopy} aria-label={`Copy ${item.accessible_name}`}>
          {copied ? "Copied!" : "Copy"}
        </button>
        <button type="button" className="btn btn--ghost btn--sm min-h-9" onClick={handleFavorite} aria-label={fav ? "Unfavorite" : "Favorite"}>
          {fav ? "★" : "☆"}
        </button>
      </div>
    </article>
  );
}
