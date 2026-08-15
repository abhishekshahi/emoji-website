"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { EmojiNamesView } from "@/lib/emoji/emoji-page-model";

const VISIBLE_TERM_LIMIT = 12;

interface EmojiNamesKeywordsSectionProps {
  names: EmojiNamesView;
}

function TermChip({ term }: { term: string }) {
  return (
    <li className="rounded-full bg-surface-muted px-3 py-1.5 text-sm">{term}</li>
  );
}

function SearchTermChip({ term }: { term: string }) {
  return (
    <li>
      <Link
        href={`/search?q=${encodeURIComponent(term)}`}
        className="inline-flex min-h-9 items-center rounded-full border border-border px-3 py-1.5 text-sm transition hover:bg-surface-muted"
      >
        {term}
      </Link>
    </li>
  );
}

function ExpandableList({
  items,
  renderItem,
  limit = VISIBLE_TERM_LIMIT,
}: {
  items: readonly string[];
  renderItem: (item: string) => ReactNode;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const hiddenCount = Math.max(items.length - limit, 0);

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2">{visible.map((item) => renderItem(item))}</ul>
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="text-sm font-semibold text-accent-strong hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? "Show fewer" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </div>
  );
}

export function EmojiNamesKeywordsSection({ names }: EmojiNamesKeywordsSectionProps) {
  const hasAliases = names.aliases.length > 0;
  const hasKeywords = names.keywords.length > 0;
  const hasSearchTerms = names.searchTerms.length > 0;
  const hasShortcodes = names.shortcodes.length > 0;
  const showOfficialName =
    names.officialName &&
    names.officialName.toLowerCase() !== names.displayName.toLowerCase();

  if (!hasAliases && !hasKeywords && !hasSearchTerms && !hasShortcodes && !showOfficialName) {
    return null;
  }

  return (
    <section className="card-surface space-y-5 p-6 sm:p-8" aria-labelledby="names-heading">
      <div className="space-y-2">
        <h2 id="names-heading" className="section-title">
          Names &amp; keywords
        </h2>
        <p className="section-subtitle">
          Official naming, aliases, and terms that help you find this emoji.
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-semibold text-muted">Display name</dt>
          <dd className="mt-1 text-base font-medium">{names.displayName}</dd>
        </div>
        {showOfficialName ? (
          <div>
            <dt className="text-sm font-semibold text-muted">Official Unicode name</dt>
            <dd className="mt-1 text-base">{names.officialName}</dd>
          </div>
        ) : null}
      </dl>

      {hasAliases ? (
        <div>
          <h3 className="text-sm font-semibold text-muted">Also known as</h3>
          <div className="mt-3">
            <ExpandableList
              items={names.aliases}
              renderItem={(alias) => <TermChip key={alias} term={alias} />}
            />
          </div>
        </div>
      ) : null}

      {hasKeywords ? (
        <div>
          <h3 className="text-sm font-semibold text-muted">Keywords</h3>
          <div className="mt-3">
            <ExpandableList
              items={names.keywords}
              renderItem={(keyword) => <TermChip key={keyword} term={keyword} />}
            />
          </div>
        </div>
      ) : null}

      {hasSearchTerms ? (
        <div>
          <h3 className="text-sm font-semibold text-muted">Search terms</h3>
          <p className="mt-1 text-sm text-muted">
            Click a term to search EmojiQuick for related emojis.
          </p>
          <div className="mt-3">
            <ExpandableList
              items={names.searchTerms}
              renderItem={(term) => <SearchTermChip key={term} term={term} />}
            />
          </div>
        </div>
      ) : null}

      {hasShortcodes ? (
        <div>
          <h3 className="text-sm font-semibold text-muted">Shortcodes</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {names.shortcodes.map((shortcode) => (
              <li
                key={shortcode}
                className="rounded-full border border-border px-3 py-1.5 font-mono text-sm"
              >
                :{shortcode}:
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
