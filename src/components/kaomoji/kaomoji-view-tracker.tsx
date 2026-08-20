"use client";

import { useEffect } from "react";
import { trackKaomojiView } from "@/lib/kaomoji/analytics/client";

interface Props {
  canonicalId: string;
  slug: string;
}

export function KaomojiViewTracker({ canonicalId, slug }: Props) {
  useEffect(() => {
    trackKaomojiView(canonicalId, slug);
  }, [canonicalId, slug]);
  return null;
}
