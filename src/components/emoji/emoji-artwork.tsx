"use client";

import { getArtworkPath } from "@/lib/artwork/providers";
import { useState } from "react";

interface EmojiArtworkProps {
  hexcode: string;
  name: string;
  emoji: string;
  size?: "card" | "detail";
  priority?: boolean;
  /** When true, parent control supplies the accessible name (avoids duplicate SR announcements). */
  decorative?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  card: "h-14 w-14 sm:h-16 sm:w-16",
  detail: "h-36 w-36 sm:h-44 sm:w-44",
} as const;

export function EmojiArtwork({
  hexcode,
  name,
  emoji,
  size = "card",
  priority = false,
  decorative = false,
  className = "",
}: EmojiArtworkProps) {
  const artworkPath = getArtworkPath(hexcode);
  const [useFallback, setUseFallback] = useState(!artworkPath);

  if (useFallback || !artworkPath) {
    return (
      <span
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : name}
        aria-hidden={decorative ? true : undefined}
        className={`inline-flex items-center justify-center leading-none ${size === "detail" ? "text-8xl sm:text-9xl" : "text-4xl sm:text-5xl"} ${className}`}
      >
        {emoji}
      </span>
    );
  }

  return (
    <span className={`relative inline-flex items-center justify-center ${SIZE_CLASSES[size]} ${className}`}>
      {/* SVG artwork: native img used for simple onError fallback to Unicode emoji */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artworkPath}
        alt={decorative ? "" : `${name} emoji`}
        aria-hidden={decorative ? true : undefined}
        width={size === "detail" ? 176 : 64}
        height={size === "detail" ? 176 : 64}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="h-full w-full object-contain"
        onError={() => setUseFallback(true)}
      />
      {!decorative ? <span className="sr-only">{emoji}</span> : null}
    </span>
  );
}
