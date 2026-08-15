import type { CanonicalIdentityType } from "@/lib/master/canonical/types";

const STYLES: Record<CanonicalIdentityType | "unknown", string> = {
  unicode: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  "source-specific": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  "private-use": "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  unknown: "bg-surface-muted text-muted",
};

interface IdentityTypeBadgeProps {
  identityType: CanonicalIdentityType | "unknown";
  label?: string;
}

export function IdentityTypeBadge({ identityType, label }: IdentityTypeBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[identityType]}`}
    >
      {label ?? identityType}
    </span>
  );
}
