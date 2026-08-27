"use client";

import { useMemo, useState } from "react";
import { analyzeText, boundInput, MAX_INPUT_LENGTH, visualizeText } from "@/lib/tools/invisible-characters/analyze";
import { InvisibleCharCopyButton } from "@/components/tools/invisible-char-copy-button";

export function InvisibleCharInspectorPanel() {
  const [input, setInput] = useState("");
  const [showInvisible, setShowInvisible] = useState(true);

  const analysis = useMemo(() => analyzeText(input), [input]);
  const visualized = useMemo(() => visualizeText(input), [input]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-muted/30 p-4 text-sm text-muted">
        <strong className="text-foreground">Privacy:</strong> Inspection runs entirely in your browser. Pasted text
        is not sent to EmojiQuick servers, logged, or stored.
      </div>

      <div className="space-y-2">
        <label htmlFor="inspect-input" className="text-sm font-semibold">
          Paste or type text
        </label>
        <textarea
          id="inspect-input"
          value={input}
          onChange={(e) => setInput(boundInput(e.target.value))}
          rows={5}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm"
          placeholder="Paste text to inspect Unicode characters…"
          spellCheck={false}
        />
        <p className="text-xs text-muted">
          {input.length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()} UTF-16 units
        </p>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="rounded-lg border border-border p-3">
          <dt className="text-muted">UTF-16 code units</dt>
          <dd className="text-lg font-semibold">{analysis.utf16Units}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-muted">Unicode code points</dt>
          <dd className="text-lg font-semibold">{analysis.unicodeCodePoints}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-muted">Grapheme clusters</dt>
          <dd className="text-lg font-semibold">{analysis.graphemeClusters ?? "—"}</dd>
          <dd className="text-xs text-muted">{analysis.graphemeMethod}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-muted">Invisible / special</dt>
          <dd className="text-lg font-semibold">{analysis.invisibleCount}</dd>
        </div>
      </dl>

      {analysis.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2" role="alert">
          <p className="font-semibold">Warnings</p>
          <ul className="list-disc pl-5 text-sm text-muted space-y-1">
            {analysis.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showInvisible}
          onChange={(e) => setShowInvisible(e.target.checked)}
        />
        Show invisible characters (visualized labels)
      </label>

      {input ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Original</h3>
            <pre className="rounded-xl border border-border bg-surface-muted/30 p-3 text-sm whitespace-pre-wrap break-all font-mono">
              {input}
            </pre>
          </div>
          {showInvisible ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Visualized</h3>
              <pre className="rounded-xl border border-border bg-surface-muted/30 p-3 text-sm whitespace-pre-wrap break-all font-mono">
                {visualized}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {analysis.segments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-3">#</th>
                <th scope="col" className="py-2 pr-3">Display</th>
                <th scope="col" className="py-2 pr-3">Code point</th>
                <th scope="col" className="py-2 pr-3">Name</th>
                <th scope="col" className="py-2">Category</th>
              </tr>
            </thead>
            <tbody>
              {analysis.segments.map((seg) => (
                <tr key={seg.index} className="border-b border-border/60">
                  <td className="py-2 pr-3 text-muted">{seg.index}</td>
                  <td className="py-2 pr-3 font-mono">{seg.visibleLabel}</td>
                  <td className="py-2 pr-3 font-mono">{seg.codePointLabel}</td>
                  <td className="py-2 pr-3">{seg.name}</td>
                  <td className="py-2 text-muted">
                    {seg.category}
                    {seg.caution ? " ⚠" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
