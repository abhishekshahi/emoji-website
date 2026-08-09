import type { UiMetadataPayload } from "@/lib/master/integration/ui/types";

interface CanonicalMetadataPanelProps {
  metadata: UiMetadataPayload;
}

export function CanonicalMetadataPanel({ metadata }: CanonicalMetadataPanelProps) {
  return (
    <section className="space-y-4 rounded-[1rem] border border-border bg-surface-muted/50 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Canonical metadata</h2>
        <p className="text-sm text-muted">
          Primary display uses the frozen canonical name from reconciliation.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-muted">Canonical name</dt>
          <dd className="mt-1 capitalize">{metadata.canonicalName}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted">Canonical identity</dt>
          <dd className="mt-1 font-mono text-xs">{metadata.canonicalId}</dd>
        </div>
      </dl>

      {metadata.safeAliases.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-muted">Safe aliases</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {metadata.safeAliases.map((alias) => (
              <li key={alias} className="rounded-full bg-surface px-3 py-1 text-sm">
                {alias}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {metadata.safeKeywords.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-muted">Safe keywords</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {metadata.safeKeywords.map((keyword) => (
              <li key={keyword} className="rounded-full bg-surface px-3 py-1 text-sm">
                {keyword}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {metadata.shortcodes.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-muted">Shortcodes</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {metadata.shortcodes.map((shortcode) => (
              <li key={shortcode} className="rounded-full border border-border px-3 py-1 font-mono text-sm">
                {shortcode.startsWith(":") ? shortcode : `:${shortcode}:`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
