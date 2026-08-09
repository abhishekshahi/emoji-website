"use client";

import { useTheme } from "@/components/providers/theme-provider";
import type { ThemePreference } from "@/lib/theme/constants";

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 10 10 0 0 0 20 14.5Z" />
    </svg>
  );
}

function themeLabel(preference: ThemePreference): string {
  if (preference === "light") {
    return "Light theme";
  }

  if (preference === "dark") {
    return "Dark theme";
  }

  return "System theme";
}

function nextThemeLabel(preference: ThemePreference): string {
  if (preference === "system") {
    return "light";
  }

  if (preference === "light") {
    return "dark";
  }

  return "system";
}

export function ThemeToggle() {
  const { preference, resolved, cyclePreference } = useTheme();

  const showSun =
    preference === "light" || (preference === "system" && resolved === "light");

  return (
    <button
      type="button"
      onClick={cyclePreference}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:bg-surface-muted"
      aria-label={`${themeLabel(preference)}. Switch to ${nextThemeLabel(preference)} theme.`}
      title={`${themeLabel(preference)} (click for ${nextThemeLabel(preference)})`}
    >
      {showSun ? <SunIcon /> : <MoonIcon />}
      {preference === "system" ? (
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent"
        />
      ) : null}
    </button>
  );
}
