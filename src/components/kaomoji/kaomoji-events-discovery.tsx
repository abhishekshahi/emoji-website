import Link from "next/link";
import {
  buildEventPagePath,
  getNearTermEvents,
  listEventGuides,
  type EventPageSlug,
} from "@/lib/kaomoji/events/registry";

export function KaomojiEventsDiscovery() {
  const nearTerm = getNearTermEvents(new Date(), 4);
  const evergreen = listEventGuides()
    .filter((g) => g.kind === "evergreen")
    .slice(0, 4);

  if (nearTerm.length === 0 && evergreen.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="kaomoji-events-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="kaomoji-events-heading" className="text-xl font-semibold">
          Seasonal & event guides
        </h2>
        <Link href="/kaomoji/events" className="text-sm underline text-muted">
          All events
        </Link>
      </div>
      {nearTerm.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">In season or coming soon</p>
          <ul className="flex flex-wrap gap-2">
            {nearTerm.map((g) => (
              <li key={g.slug}>
                <Link href={buildEventPagePath(g.slug as EventPageSlug)} className="chip">
                  {g.h1}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {evergreen.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Evergreen occasions</p>
          <ul className="flex flex-wrap gap-2">
            {evergreen.map((g) => (
              <li key={g.slug}>
                <Link href={buildEventPagePath(g.slug as EventPageSlug)} className="chip">
                  {g.h1}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
