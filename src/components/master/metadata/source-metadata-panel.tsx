"use client";

import { useState } from "react";
import type { UiMetadataPayload } from "@/lib/master/integration/ui/types";

interface SourceMetadataPanelProps {
  metadata: UiMetadataPayload;
}

export function SourceMetadataPanel({ metadata }: SourceMetadataPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="space-y-4 rounded-[1rem] border border-border bg-surface-muted/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Source metadata</h2>
          <p className="text-sm text-muted">
            Source-specific values are preserved separately. Noto and Twemoji metadata are unavailable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-h-10 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold"
          aria-expanded={expanded}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      {expanded ? (
        <div className="space-y-4">
          {metadata.sourcePanels.map((panel) => (
            <article key={panel.source} className="rounded-[0.875rem] border border-border bg-surface p-4">
              <h3 className="font-semibold">{panel.label}</h3>
              {!panel.available ? (
                <p className="mt-2 text-sm text-muted">Metadata unavailable</p>
              ) : (
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {panel.name ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Name</dt>
                      <dd className="mt-1 text-sm">{panel.name}</dd>
                    </div>
                  ) : null}
                  {panel.definition ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Definition</dt>
                      <dd className="mt-1 text-sm text-muted">{panel.definition}</dd>
                    </div>
                  ) : null}
                  {panel.keywords.length > 0 ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Keywords</dt>
                      <dd className="mt-1 text-sm">{panel.keywords.join(", ")}</dd>
                    </div>
                  ) : null}
                  {panel.aliases.length > 0 ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Aliases</dt>
                      <dd className="mt-1 text-sm">{panel.aliases.join(", ")}</dd>
                    </div>
                  ) : null}
                  {panel.shortcodes.length > 0 ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Shortcodes</dt>
                      <dd className="mt-1 text-sm">{panel.shortcodes.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
