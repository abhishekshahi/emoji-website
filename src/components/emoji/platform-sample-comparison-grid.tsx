import Link from "next/link";
import type { SampleComparisonItem } from "@/lib/emoji/platforms/types";

interface PlatformSampleComparisonGridProps {
  readonly items: readonly SampleComparisonItem[];
}

export function PlatformSampleComparisonGrid({ items }: PlatformSampleComparisonGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-muted">
        Sample comparison unavailable — open-source artwork requires at least two publicly served providers per
        emoji.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {items.map((item) => (
        <article key={item.slug} className="space-y-4 rounded-xl border border-border p-4 sm:p-6">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">
              <Link href={`/emoji/${item.slug}`} className="hover:underline">
                {item.label}
              </Link>
            </h3>
            <p className="text-sm text-muted">{item.comparison.codePointString}</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Style
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Reference artwork
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    License
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/60">
                  <th scope="row" className="py-3 pr-4 align-middle font-medium">
                    Unicode glyph
                  </th>
                  <td className="py-3 pr-4 text-3xl leading-none" aria-hidden="true">
                    {item.comparison.unicodeGlyph}
                  </td>
                  <td className="py-3 text-muted">System / font dependent</td>
                </tr>
                {item.comparison.openSourceTiles.map((tile) => (
                  <tr key={tile.provider} className="border-b border-border/60">
                    <th scope="row" className="py-3 pr-4 align-middle font-medium">
                      {tile.label}
                    </th>
                    <td className="py-3 pr-4">
                      {tile.url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={tile.url}
                          alt={`${item.label} — ${tile.label}`}
                          width={48}
                          height={48}
                          loading="lazy"
                          className="h-12 w-12 object-contain"
                        />
                      ) : (
                        <span className="text-2xl" aria-hidden="true">
                          {item.comparison.unicodeGlyph}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-muted">{tile.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </div>
  );
}
