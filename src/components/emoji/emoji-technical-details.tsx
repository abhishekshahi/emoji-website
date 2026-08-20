"use client";

import { CopyButton } from "@/components/emoji/copy-button";
import type { EmojiTechnicalView } from "@/lib/emoji/emoji-page-model";

interface EmojiTechnicalDetailsProps {
  technical: EmojiTechnicalView;
  emojiId: string;
}

function TechnicalRow({
  label,
  value,
  copyValue,
  emojiId,
}: {
  label: string;
  value: string;
  copyValue?: string;
  emojiId: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <dt className="text-sm font-semibold text-muted">{label}</dt>
        <dd className="mt-1 break-all font-mono text-sm">{value}</dd>
      </div>
      {copyValue ? (
        <CopyButton
          label={`Copy ${label.toLowerCase()}`}
          value={copyValue}
          emojiId={emojiId}
          toastMessage={`Copied ${copyValue}`}
        />
      ) : null}
    </div>
  );
}

export function EmojiTechnicalDetails({ technical, emojiId }: EmojiTechnicalDetailsProps) {
  const utf8Bytes = technical.codePoints
    .map((codePoint) => {
      const value = Number.parseInt(codePoint, 16);
      if (!Number.isFinite(value)) return null;
      if (value <= 0x7f) return value.toString(16).padStart(2, "0").toUpperCase();
      if (value <= 0x7ff) {
        const b1 = 0xc0 | (value >> 6);
        const b2 = 0x80 | (value & 0x3f);
        return [b1, b2].map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
      }
      if (value <= 0xffff) {
        const b1 = 0xe0 | (value >> 12);
        const b2 = 0x80 | ((value >> 6) & 0x3f);
        const b3 = 0x80 | (value & 0x3f);
        return [b1, b2, b3].map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ");
      }
      return null;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join(" ");

  return (
    <section className="card-surface p-6 sm:p-8">
      <details className="group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="section-title">Technical information</h2>
              <p className="section-subtitle">
                Unicode code points, sequence details, and copy-friendly values.
              </p>
            </div>
            <span
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted transition group-open:bg-surface-muted"
              aria-hidden="true"
            >
              Expand
            </span>
          </div>
        </summary>

        <dl className="mt-6 space-y-5 border-t border-border pt-6">
          <TechnicalRow
            label="Emoji character"
            value={technical.emoji}
            copyValue={technical.emoji}
            emojiId={emojiId}
          />
          {technical.officialName ? (
            <TechnicalRow
              label="Unicode name"
              value={technical.officialName}
              copyValue={technical.officialName}
              emojiId={emojiId}
            />
          ) : null}
          <TechnicalRow
            label="Unicode version"
            value={technical.unicodeVersion}
            emojiId={emojiId}
          />
          <TechnicalRow
            label="Code points"
            value={technical.codePointString}
            copyValue={technical.codePointString}
            emojiId={emojiId}
          />
          <TechnicalRow
            label="Hex code"
            value={technical.hexcode}
            copyValue={technical.hexcode}
            emojiId={emojiId}
          />
          {utf8Bytes ? (
            <TechnicalRow
              label="UTF-8 (hex bytes)"
              value={utf8Bytes}
              copyValue={utf8Bytes}
              emojiId={emojiId}
            />
          ) : null}
          <TechnicalRow
            label="Qualification"
            value={technical.qualificationStatus}
            emojiId={emojiId}
          />
          <TechnicalRow
            label="Sequence type"
            value={technical.sequenceKind}
            emojiId={emojiId}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-semibold text-muted">Variation selector</dt>
              <dd className="mt-1 text-sm">{technical.hasVariationSelector ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">ZWJ sequence</dt>
              <dd className="mt-1 text-sm">{technical.hasZeroWidthJoiner ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">RGI sequence</dt>
              <dd className="mt-1 text-sm">{technical.isRgi ? "Yes" : "No"}</dd>
            </div>
          </div>
        </dl>
      </details>
    </section>
  );
}
