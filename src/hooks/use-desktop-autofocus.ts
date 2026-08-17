"use client";
import { useEffect, useState } from "react";
export function useDesktopAutofocus(enabled: boolean): boolean {
  const [shouldFocus, setShouldFocus] = useState(false);
  useEffect(() => {
    if (!enabled) { setShouldFocus(false); return; }
    const media = window.matchMedia("(min-width: 768px), (pointer: fine)");
    const update = () => setShouldFocus(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [enabled]);
  return shouldFocus;
}
