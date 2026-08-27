import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { InvisibleCharToolNav } from "@/components/tools/invisible-char-tool-nav";
import {
  INVISIBLE_TOOLS_INDEX,
  listInvisibleToolPages,
} from "@/lib/tools/invisible-characters/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: INVISIBLE_TOOLS_INDEX.title,
  description: INVISIBLE_TOOLS_INDEX.description,
  path: INVISIBLE_TOOLS_INDEX.path,
});

export default function InvisibleCharactersIndexPage() {
  const tools = listInvisibleToolPages();

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: INVISIBLE_TOOLS_INDEX.h1,
          url: "https://emojiquick.com/tools/invisible-characters",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web browser",
          description: INVISIBLE_TOOLS_INDEX.description,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools/invisible-characters" },
          { name: "Invisible characters", path: INVISIBLE_TOOLS_INDEX.path },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">{INVISIBLE_TOOLS_INDEX.h1}</h1>
        <p className="text-muted">{INVISIBLE_TOOLS_INDEX.intro}</p>
      </header>

      <InvisibleCharToolNav active="index" />

      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted max-w-3xl">
        <strong className="text-foreground">Safety:</strong> These are legitimate text utilities — not evasion tools.
        Invisible characters can be abused for spoofing or moderation bypass. Use only when you understand the impact.
        Pasted text is processed client-side and is not uploaded to EmojiQuick.
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <li key={tool.slug} className="rounded-xl border border-border p-4 space-y-2">
            <Link href={tool.path} className="text-lg font-semibold hover:underline">
              {tool.h1}
            </Link>
            <p className="text-sm text-muted">{tool.description}</p>
          </li>
        ))}
      </ul>

      <section className="prose max-w-3xl">
        <h2 className="text-xl font-semibold not-prose">Supported characters</h2>
        <p className="text-muted text-sm">
          Zero width space (U+200B), zero width non-joiner (U+200C), zero width joiner (U+200D), word joiner (U+2060),
          and BOM / zero width no-break space (U+FEFF) — each with clear usage notes. See also{" "}
          <Link href="/emoji-unicode" className="underline">
            Unicode guide
          </Link>{" "}
          and{" "}
          <Link href="/kaomoji" className="underline">
            kaomoji
          </Link>{" "}
          (text faces, not emoji artwork).
        </p>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/emoji" className="pill-link">
          Emoji
        </Link>
        <Link href="/emoji-unicode" className="pill-link">
          Unicode guide
        </Link>
      </div>
    </div>
  );
}
