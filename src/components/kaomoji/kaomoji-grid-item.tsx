import Link from "next/link";
import type { KaomojiCardData } from "./kaomoji-card";

interface KaomojiGridItemProps {
  item: KaomojiCardData;
}

/** Server-rendered collection grid cell — avoids client hydration on large collection pages. */
export function KaomojiGridItem({ item }: KaomojiGridItemProps) {
  return (
    <article className="emoji-card group p-2 sm:p-3">
      <Link
        href={`/kaomoji/${item.slug}`}
        className="block space-y-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={item.accessible_name}
      >
        <div className="text-2xl sm:text-3xl leading-none break-all px-1" aria-hidden="true">
          {item.content}
        </div>
        {item.name ? <p className="text-xs text-muted truncate">{item.name}</p> : null}
      </Link>
    </article>
  );
}
