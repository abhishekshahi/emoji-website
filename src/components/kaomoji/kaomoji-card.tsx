"use client";

import Link from "next/link";
import { KaomojiCopyButton } from "@/components/kaomoji/kaomoji-copy-button";
import { KaomojiSaveButton } from "@/components/kaomoji/kaomoji-save-button";
import { buildSavePayload } from "@/lib/kaomoji/personal/client-store";

export interface KaomojiCardData {
  canonical_id: string;
  slug: string;
  content: string;
  name: string | null;
  accessible_name: string;
  reason?: string | null;
}

interface KaomojiCardProps {
  item: KaomojiCardData;
}

export function KaomojiCard({ item }: KaomojiCardProps) {
  const savePayload = buildSavePayload({
    id: item.canonical_id,
    content: item.content,
    slug: item.slug,
    name: item.name,
    accessible_name: item.accessible_name,
    source: "public",
  });

  return (
    <article className="emoji-card group p-2 sm:p-3">
      <Link href={`/kaomoji/${item.slug}`} className="block space-y-2 text-center" aria-label={item.accessible_name}>
        <div className="text-2xl sm:text-3xl leading-none break-all px-1" aria-hidden="true">{item.content}</div>
        {item.name ? <p className="text-xs text-muted truncate">{item.name}</p> : null}
        {item.reason ? <p className="text-[11px] text-muted/80 truncate">{item.reason}</p> : null}
      </Link>
      <div className="mt-2 flex gap-1 justify-center">
        <KaomojiCopyButton
          content={item.content}
          accessibleName={item.accessible_name}
          canonicalId={item.canonical_id}
          slug={item.slug}
          size="sm"
        />
        <KaomojiSaveButton payload={savePayload} variant="icon" size="sm" />
      </div>
    </article>
  );
}
