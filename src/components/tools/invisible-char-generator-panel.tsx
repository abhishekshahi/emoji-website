"use client";

import { useMemo, useState } from "react";
import { GENERATOR_CHARACTERS, charFromCodePoint, formatCodePoint } from "@/lib/tools/invisible-characters/characters";
import { InvisibleCharCopyButton } from "@/components/tools/invisible-char-copy-button";

export function InvisibleCharGeneratorPanel() {
  const [selectedHex, setSelectedHex] = useState(GENERATOR_CHARACTERS[0]!.hex);
  const selected = GENERATOR_CHARACTERS.find((c) => c.hex === selectedHex) ?? GENERATOR_CHARACTERS[0]!;
  const literal = useMemo(() => charFromCodePoint(selected.codePoint), [selected.codePoint]);
  const [repeat, setRepeat] = useState(1);

  const output = literal.repeat(Math.min(Math.max(repeat, 1), 32));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted">
        <strong className="text-foreground">Use responsibly.</strong> Invisible characters can be misused for
        impersonation or moderation evasion. Only use for legitimate formatting needs you understand.
      </div>

      <div className="space-y-2">
        <label htmlFor="char-select" className="text-sm font-semibold">
          Select character
        </label>
        <select
          id="char-select"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          value={selectedHex}
          onChange={(e) => setSelectedHex(e.target.value)}
        >
          {GENERATOR_CHARACTERS.map((c) => (
            <option key={c.hex} value={c.hex}>
              {formatCodePoint(c.codePoint)} — {c.name}
            </option>
          ))}
        </select>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="rounded-lg border border-border p-3">
          <dt className="font-medium text-muted">Name</dt>
          <dd>{selected.name}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="font-medium text-muted">Code point</dt>
          <dd className="font-mono">{formatCodePoint(selected.codePoint)}</dd>
        </div>
        <div className="rounded-lg border border-border p-3 sm:col-span-2">
          <dt className="font-medium text-muted">Usage</dt>
          <dd>{selected.usage}</dd>
        </div>
        {selected.caution ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 sm:col-span-2">
            <dt className="font-medium">Caution</dt>
            <dd>{selected.caution}</dd>
          </div>
        ) : null}
      </dl>

      <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3">
        <p className="text-sm font-semibold">Visible representation</p>
        <p className="font-mono text-lg">[{selected.shortLabel}]</p>
        <p className="text-xs text-muted">The character itself may appear blank — rely on the label and code point.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="repeat-count" className="text-sm font-medium">
            Count (1–32)
          </label>
          <input
            id="repeat-count"
            type="number"
            min={1}
            max={32}
            value={repeat}
            onChange={(e) => setRepeat(Number(e.target.value) || 1)}
            className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <InvisibleCharCopyButton content={output} label={`${selected.name} (${repeat})`} />
      </div>
    </div>
  );
}
