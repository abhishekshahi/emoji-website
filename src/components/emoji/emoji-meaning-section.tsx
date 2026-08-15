import Link from "next/link";
import type { EmojiMeaningView } from "@/lib/emoji/emoji-page-model";

interface EmojiMeaningSectionProps {
  emojiName: string;
  meaning: EmojiMeaningView;
}

export function EmojiMeaningSection({ emojiName, meaning }: EmojiMeaningSectionProps) {
  const hasContent =
    meaning.summary ||
    meaning.definitions.length > 1 ||
    meaning.relatedConcepts.length > 0;

  if (!hasContent) {
    return null;
  }

  const additionalDefinitions = meaning.definitions.slice(1);

  return (
    <section className="card-surface space-y-5 p-6 sm:p-8" aria-labelledby="meaning-heading">
      <div className="space-y-2">
        <h2 id="meaning-heading" className="section-title">
          Meaning &amp; usage
        </h2>
        <p className="section-subtitle">
          How {emojiName} is commonly understood and used.
        </p>
      </div>

      {meaning.summary ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Meaning</h3>
          <p className="text-base leading-relaxed text-foreground">{meaning.summary}</p>
        </div>
      ) : null}

      {additionalDefinitions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Additional definitions
          </h3>
          <ul className="space-y-3">
            {additionalDefinitions.map((definition) => (
              <li
                key={`${definition.source}-${definition.text.slice(0, 32)}`}
                className="rounded-xl border border-border bg-surface-muted/50 p-4"
              >
                <p className="text-sm leading-relaxed text-muted">{definition.text}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-muted">
                  Source: {definition.source}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : meaning.summary && meaning.definitions[0] ? (
        <p className="text-xs uppercase tracking-wide text-muted">
          Source: {meaning.definitions[0].source}
        </p>
      ) : null}

      {meaning.relatedConcepts.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Related concepts
          </h3>
          <ul className="flex flex-wrap gap-2">
            {meaning.relatedConcepts.map((concept) => (
              <li key={concept}>
                <Link
                  href={`/search?q=${encodeURIComponent(concept)}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-border px-3 py-1.5 text-sm transition hover:bg-surface-muted"
                >
                  {concept}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
