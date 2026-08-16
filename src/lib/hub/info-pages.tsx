import Link from "next/link";
import { HubLayout } from "@/components/hub/hub-layout";
import { HubGuidesNav } from "@/components/hub/hub-nav-sections";
import { HUB_GUIDE_LINKS } from "@/lib/hub/hub-navigation";
import { getAllCategorySlugs, getCategoryLabel } from "@/lib/emoji/data";
import { getProviderArchitecture } from "@/lib/artwork/provider-architecture";
import { INFO_PAGE_SLUGS, type InfoPageSlug } from "./hub-routes";

export interface InfoPageContent {
  title: string;
  description: string;
  sections: readonly { heading: string; body: React.ReactNode }[];
}

export function getInfoPageContent(slug: InfoPageSlug): InfoPageContent {
  switch (slug) {
    case "about":
      return {
        title: "About EmojiQuick",
        description: "EmojiQuick is a fast emoji search, copy, and reference site with 6,955 public emoji identity pages.",
        sections: [
          {
            heading: "What is EmojiQuick?",
            body: (
              <p>
                EmojiQuick helps you find, copy, and understand emojis with Unicode details, artwork, and
                searchable metadata. All 6,955 canonical emoji identities have dedicated public pages.
              </p>
            ),
          },
          {
            heading: "Data sources",
            body: (
              <p>
                Emoji names and metadata come from the frozen master 8.10 release (Unicode, CLDR, OpenMoji, and
                other indexed sources). Artwork follows a license-aware resolver across Noto, Fluent, OpenMoji,
                and Twemoji.
              </p>
            ),
          },
          {
            heading: "Guides",
            body: (
              <p>
                <Link href="/emoji-guide" className="text-accent-strong underline">Emoji guide</Link>
                {" · "}
                <Link href="/emoji-unicode" className="text-accent-strong underline">Unicode</Link>
                {" · "}
                <Link href="/emoji-artwork" className="text-accent-strong underline">Artwork</Link>
                {" · "}
                <Link href="/privacy" className="text-accent-strong underline">Privacy</Link>
              </p>
            ),
          },
        ],
      };
    case "emoji-guide":
      return {
        title: "Emoji Guide",
        description: "How to use EmojiQuick to browse, copy, and understand emojis.",
        sections: [
          { heading: "Browse", body: <p>Start from the homepage, category pages, topic collections, or search.</p> },
          { heading: "Copy", body: <p>Each emoji detail page includes one-click copy for the glyph and Unicode info.</p> },
          { heading: "Learn", body: <p>Read meanings, keywords, variants, and technical Unicode details on every page.</p> },
          {
            heading: "Related guides",
            body: (
              <p>
                <Link href="/emoji-unicode" className="text-accent-strong underline">Unicode reference</Link>
                {" · "}
                <Link href="/emoji-artwork" className="text-accent-strong underline">Artwork</Link>
                {" · "}
                <Link href="/emoji-categories" className="text-accent-strong underline">Categories</Link>
              </p>
            ),
          },
        ],
      };
    case "emoji-search-guide":
      return {
        title: "Emoji Search Guide",
        description: "Tips for finding emojis quickly on EmojiQuick.",
        sections: [
          { heading: "Keyword search", body: <p>Use the search bar for names, keywords, and common phrases like &quot;heart&quot; or &quot;fire&quot;.</p> },
          { heading: "Categories & topics", body: <p>Browse <Link href="/emoji-categories" className="text-accent-strong underline">categories</Link> or <Link href="/explore" className="text-accent-strong underline">explore collections</Link>.</p> },
        ],
      };
    case "emoji-copy-guide":
      return {
        title: "Emoji Copy Guide",
        description: "Copy emojis to clipboard from any EmojiQuick detail page.",
        sections: [
          { heading: "One-click copy", body: <p>Click the copy button on an emoji page to copy the character to your clipboard.</p> },
          { heading: "Unicode reference", body: <p>Each page shows code points for developers and cross-platform reference.</p> },
        ],
      };
    case "emoji-artwork":
      return {
        title: "Emoji Artwork on EmojiQuick",
        description: "How EmojiQuick resolves and serves emoji artwork across providers.",
        sections: [
          {
            heading: "Resolver priority",
            body: (
              <ol className="list-decimal space-y-1 pl-5">
                <li>Noto (default, indexed)</li>
                <li>Fluent (premium, indexed)</li>
                <li>OpenMoji (public)</li>
                <li>Twemoji (public)</li>
              </ol>
            ),
          },
          { heading: "Learn more", body: <p>See <Link href="/styles" className="text-accent-strong underline">artwork styles</Link>, <Link href="/emoji-license" className="text-accent-strong underline">license information</Link>, and <Link href="/licenses" className="text-accent-strong underline">the full license registry</Link>.</p> },
        ],
      };
    case "emoji-styles":
      return {
        title: "Emoji Styles",
        description: "Overview of artwork styles available through EmojiQuick's resolver.",
        sections: [
          {
            heading: "Available styles",
            body: (
              <ul className="list-disc space-y-1 pl-5">
                {getProviderArchitecture().map((p) => (
                  <li key={p.provider}>
                    {p.label} — {p.publiclyServed ? "publicly served" : "indexed only"}
                  </li>
                ))}
              </ul>
            ),
          },
          { heading: "Style pages", body: <p><Link href="/styles" className="text-accent-strong underline">Browse all style pages</Link></p> },
        ],
      };
    case "emoji-unicode":
      return {
        title: "Emoji Unicode Reference",
        description: "Unicode code points and sequences on EmojiQuick emoji pages.",
        sections: [
          { heading: "Code points", body: <p>Each emoji page shows Unicode code points (e.g. U+1F525) where available.</p> },
          {
            heading: "Browse examples",
            body: (
              <p>
                <Link href="/emoji/fire" className="text-accent-strong underline">Fire emoji</Link>
                {" · "}
                <Link href="/emoji/red-heart" className="text-accent-strong underline">Red heart</Link>
                {" · "}
                <Link href="/emoji-guide" className="text-accent-strong underline">Emoji guide</Link>
              </p>
            ),
          },
          { heading: "ZWJ sequences", body: <p>Complex emojis like flags and family combinations are documented with their full sequences.</p> },
        ],
      };
    case "emoji-categories":
      return {
        title: "Emoji Categories",
        description: "Browse emojis by Unicode category groups on EmojiQuick.",
        sections: [
          {
            heading: "Unicode categories",
            body: (
              <ul className="grid gap-2 sm:grid-cols-2">
                {getAllCategorySlugs().slice(0, 12).map((id) => (
                  <li key={id}>
                    <Link href={`/category/${id}`} className="text-accent-strong underline">
                      {getCategoryLabel(id)}
                    </Link>
                  </li>
                ))}
              </ul>
            ),
          },
          { heading: "Topic collections", body: <p><Link href="/explore" className="text-accent-strong underline">Explore topic collections</Link> for themed groups like hearts, animals, and celebration.</p> },
        ],
      };
    case "emoji-license":
      return {
        title: "Emoji Licenses",
        description: "Provider licenses and public serving policy for emoji artwork on EmojiQuick.",
        sections: [
          { heading: "Public providers", body: <p>OpenMoji (CC BY-SA 4.0) and Twemoji (CC BY 4.0) may be publicly served with attribution.</p> },
          { heading: "Indexed providers", body: <p>Noto and Fluent artwork is publicly served under verified Apache/OFL and MIT license policies when path classification passes the asset-rights gate.</p> },
          { heading: "Full registry", body: <p><Link href="/licenses" className="text-accent-strong underline">View the full license registry</Link> and <Link href="/emoji-artwork" className="text-accent-strong underline">artwork overview</Link>.</p> },
        ],
      };
    case "privacy":
      return {
        title: "Privacy",
        description: "Privacy practices for EmojiQuick.",
        sections: [
          { heading: "Local preferences", body: <p>Favorites and recent emojis may be stored in your browser local storage. This data stays on your device.</p> },
          { heading: "No accounts", body: <p>EmojiQuick does not require user accounts for browsing or copying emojis.</p> },
          { heading: "Analytics", body: <p>Discovery rankings on this site use editorial baselines unless live analytics are explicitly enabled in a future phase.</p> },
          { heading: "Legal", body: <p><Link href="/about" className="text-accent-strong underline">About EmojiQuick</Link></p> },
        ],
      };
  }
}

export function InfoHubPage({ slug }: { slug: InfoPageSlug }) {
  const content = getInfoPageContent(slug);
  const path = `/${slug}`;

  return (
    <HubLayout path={path} title={content.title} description={content.description} eyebrow="Guide">
      {content.sections.map((section) => (
        <section key={section.heading} className="card-surface space-y-3 p-6">
          <h2 className="text-xl font-semibold">{section.heading}</h2>
          <div className="prose-sm text-muted [&_p]:leading-relaxed">{section.body}</div>
        </section>
      ))}
      <nav className="flex flex-wrap gap-2" aria-label="Guide pages">
        {HUB_GUIDE_LINKS.filter((link) => link.href !== path).map((link) => (
          <Link key={link.href} href={link.href} className="pill-link">
            {link.label}
          </Link>
        ))}
      </nav>
      <HubGuidesNav />
    </HubLayout>
  );
}
