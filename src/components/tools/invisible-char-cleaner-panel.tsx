"use client";

import { useMemo, useState } from "react";
import {
  BIDI_CONTROL_CHARACTERS,
  GENERATOR_CHARACTERS,
  formatCodePoint,
} from "@/lib/tools/invisible-characters/characters";
import { boundInput, cleanText, MAX_INPUT_LENGTH } from "@/lib/tools/invisible-characters/analyze";
import { InvisibleCharCopyButton } from "@/components/tools/invisible-char-copy-button";

function initialRemoveSet(): Set<number> {
  return new Set(GENERATOR_CHARACTERS.filter((c) => c.hex !== "200D").map((c) => c.codePoint));
}

export function InvisibleCharCleanerPanel() {
  const [input, setInput] = useState("");
  const [removeSet, setRemoveSet] = useState<Set<number>>(initialRemoveSet);

  const toggle = (cp: number) => {
    setRemoveSet((prev) => {
      const next = new Set(prev);
      if (next.has(cp)) next.delete(cp);
      else next.add(cp);
      return next;
    });
  };

  const toggleBidi = (checked: boolean) => {
    setRemoveSet((prev) => {
      const next = new Set(prev);
      for (const c of BIDI_CONTROL_CHARACTERS) {
        if (checked) next.add(c.codePoint);
        else next.delete(c.codePoint);
      }
      return next;
    });
  };

  const removeBidi = BIDI_CONTROL_CHARACTERS.some((c) => removeSet.has(c.codePoint));

  const result = useMemo(() => cleanText(input, removeSet), [input, removeSet]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted">
        Removal is explicit — nothing is changed until you review counts below. ZWJ is off by default to protect emoji
        sequences.
      </div>

      <div className="space-y-2">
        <label htmlFor="clean-input" className="text-sm font-semibold">
          Text to clean
        </label>
        <textarea
          id="clean-input"
          value={input}
          onChange={(e) => setInput(boundInput(e.target.value))}
          rows={5}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm"
          spellCheck={false}
        />
        <p className="text-xs text-muted">
          {input.length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()} UTF-16 units
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Remove characters</legend>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          {GENERATOR_CHARACTERS.map((c) => (
            <label key={c.hex} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeSet.has(c.codePoint)}
                onChange={() => toggle(c.codePoint)}
              />
              {formatCodePoint(c.codePoint)} {c.shortLabel}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={removeSet.has(0x00ad)}
              onChange={() => toggle(0x00ad)}
            />
            U+00AD SOFT HYPHEN
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={removeBidi} onChange={(e) => toggleBidi(e.target.checked)} />
            Bidirectional controls (LRO/RLO/RLI…)
          </label>
        </div>
      </fieldset>

      <dl className="grid gap-2 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border border-border p-3">
          <dt className="text-muted">Characters removed</dt>
          <dd className="text-lg font-semibold">{result.removedCount}</dd>
        </div>
        <div className="rounded-lg border border-border p-3 sm:col-span-2">
          <dt className="text-muted">Removed breakdown</dt>
          <dd className="font-mono text-xs">
            {Object.keys(result.removedByCodePoint).length
              ? Object.entries(result.removedByCodePoint)
                  .map(([k, v]) => `${k}×${v}`)
                  .join(", ")
              : "—"}
          </dd>
        </div>
      </dl>

      {input ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Cleaned text</h3>
          <pre className="rounded-xl border border-border bg-surface-muted/30 p-3 text-sm whitespace-pre-wrap break-all font-mono min-h-[3rem]">
            {result.cleaned || "(empty)"}
          </pre>
          <InvisibleCharCopyButton content={result.cleaned} label="cleaned text" />
        </div>
      ) : null}
    </div>
  );
}
