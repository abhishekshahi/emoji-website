"use client";

import { useEffect, useRef } from "react";
import { trackClientEvent } from "@/lib/content/analytics/client";

interface EmojiViewTrackerProps {
  readonly canonicalId: string;
  readonly slug: string;
}

/** Fire-and-forget emoji view event — non-blocking. */
export function EmojiViewTracker({ canonicalId, slug }: EmojiViewTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackClientEvent("emoji_view", canonicalId, slug);
  }, [canonicalId, slug]);

  return null;
}
