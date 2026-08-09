import type { ArtworkAttributionInfo } from "@/lib/master/integration/ui/types";

interface ArtworkAttributionProps {
  attribution: ArtworkAttributionInfo;
  compact?: boolean;
}

export function ArtworkAttribution({ attribution, compact = false }: ArtworkAttributionProps) {
  return (
    <div className={`text-sm text-muted ${compact ? "space-y-1" : "space-y-2"}`}>
      <p>
        <span className="font-semibold text-foreground">{attribution.providerLabel}</span>
        {" · "}
        <a
          href={attribution.licenseURL}
          className="text-accent-strong underline"
          target="_blank"
          rel="noreferrer"
        >
          {attribution.license}
        </a>
      </p>
      {attribution.attribution ? <p>{attribution.attribution}</p> : null}
      {!compact ? (
        <p className="text-xs">Source version: {attribution.sourceVersion}</p>
      ) : null}
    </div>
  );
}
