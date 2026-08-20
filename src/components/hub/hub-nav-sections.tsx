import Link from "next/link";
import {
  HUB_CONTEXT_LINKS,
  HUB_GUIDE_LINKS,
  HUB_POPULAR_SORT_LINKS,
  HUB_STYLE_LINKS,
  HUB_TRENDING_PERIOD_LINKS,
  HUB_TOPIC_LINKS,
  type HubNavLink,
} from "@/lib/hub/hub-navigation";

function NavPills({ links, ariaLabel }: { links: readonly HubNavLink[]; ariaLabel: string }) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="pill-link">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function NavCardGrid({
  links,
  ariaLabel,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  links: readonly HubNavLink[];
  ariaLabel: string;
  columns?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={`grid gap-3 ${columns}`}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="card-surface flex items-center gap-3 p-4 transition hover:border-accent"
        >
          {link.description ? (
            <span className="text-2xl" aria-hidden="true">{link.description}</span>
          ) : null}
          <span className="font-medium text-foreground">{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function HubPopularSortNav() {
  return (
    <section className="card-surface space-y-3 p-6">
      <h2 className="text-xl font-semibold">Popular collections</h2>
      <p className="text-sm text-muted">Editorial baseline rankings — not live analytics.</p>
      <NavPills links={HUB_POPULAR_SORT_LINKS} ariaLabel="Popular sort pages" />
    </section>
  );
}

export function HubTrendingNav() {
  return (
    <section className="card-surface space-y-3 p-6">
      <h2 className="text-xl font-semibold">Trending periods</h2>
      <NavPills links={HUB_TRENDING_PERIOD_LINKS} ariaLabel="Trending period pages" />
    </section>
  );
}

export function HubTopicsNav() {
  return (
    <section className="card-surface space-y-4 p-6">
      <h2 className="text-xl font-semibold">Topic collections</h2>
      <p className="text-sm text-muted">Curated emoji groups by theme.</p>
      <NavCardGrid links={HUB_TOPIC_LINKS} ariaLabel="Topic collection pages" />
    </section>
  );
}

export function HubContextNav() {
  return (
    <section className="card-surface space-y-4 p-6">
      <h2 className="text-xl font-semibold">Context collections</h2>
      <p className="text-sm text-muted">Emoji picks for common apps and situations.</p>
      <NavCardGrid links={HUB_CONTEXT_LINKS} ariaLabel="Context pages" columns="sm:grid-cols-2" />
    </section>
  );
}

export function HubStylesNav({ compact = false }: { compact?: boolean }) {
  const links = compact
    ? HUB_STYLE_LINKS.filter((l) =>
        ["/styles/noto", "/styles/fluent", "/styles/openmoji", "/styles/twemoji"].includes(l.href),
      )
    : HUB_STYLE_LINKS;

  return (
    <section className="card-surface space-y-3 p-6">
      <h2 className="text-xl font-semibold">Artwork styles</h2>
      <NavPills links={links} ariaLabel="Artwork style pages" />
      {compact ? (
        <p className="text-sm text-muted">
          <Link href="/styles" className="text-accent-strong underline">View all artwork styles</Link>
        </p>
      ) : null}
    </section>
  );
}

export function HubGuidesNav() {
  return (
    <section className="card-surface space-y-3 p-6">
      <h2 className="text-xl font-semibold">Guides & reference</h2>
      <NavPills links={HUB_GUIDE_LINKS} ariaLabel="Guide and information pages" />
    </section>
  );
}

export function HubExploreSections() {
  return (
    <div className="space-y-6">
      <HubTrendingNav />
      <HubTopicsNav />
      <HubContextNav />
      <HubStylesNav compact />
      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">More ways to explore</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <Link href="/explore/new" className="text-accent-strong underline">New & noteworthy emojis</Link>
          </li>
          <li>
            <Link href="/popular" className="text-accent-strong underline">Popular emojis hub</Link>
          </li>
          <li>
            <Link href="/emoji" className="text-accent-strong underline">All emoji pages</Link>
          </li>
          <li>
            <Link href="/search" className="text-accent-strong underline">Search</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

export function HubFooterNavigation() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Explore</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link href="/explore" className="hover:text-accent-strong">Explore</Link></li>
          <li><Link href="/trending" className="hover:text-accent-strong">Trending</Link></li>
          <li><Link href="/topics/hearts" className="hover:text-accent-strong">Topics</Link></li>
          <li><Link href="/context/instagram" className="hover:text-accent-strong">Context</Link></li>
          <li><Link href="/styles" className="hover:text-accent-strong">Styles</Link></li>
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Popular</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link href="/popular" className="hover:text-accent-strong">Popular hub</Link></li>
          {HUB_POPULAR_SORT_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-accent-strong">{link.label}</Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Guides</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link href="/emoji-guide" className="hover:text-accent-strong">Emoji Guide</Link></li>
          <li><Link href="/emoji-unicode" className="hover:text-accent-strong">Unicode</Link></li>
          <li><Link href="/emoji-artwork" className="hover:text-accent-strong">Artwork</Link></li>
          <li><Link href="/emoji-license" className="hover:text-accent-strong">License</Link></li>
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Company</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li><Link href="/about" className="hover:text-accent-strong">About</Link></li>
          <li><Link href="/privacy" className="hover:text-accent-strong">Privacy</Link></li>
          <li><Link href="/licenses" className="hover:text-accent-strong">Licenses</Link></li>
        </ul>
      </div>
    </div>
  );
}
