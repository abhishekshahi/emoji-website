import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { InvisibleCharInspectorPanel } from "@/components/tools/invisible-char-inspector-panel";
import { InvisibleCharToolNav } from "@/components/tools/invisible-char-tool-nav";
import { getInvisibleToolPage } from "@/lib/tools/invisible-characters/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

const PAGE = getInvisibleToolPage("inspector")!;

export const metadata: Metadata = createPageMetadata({
  title: PAGE.title,
  description: PAGE.description,
  path: PAGE.path,
});

/** Unicode character inspector — also serves /tools/invisible-characters/unicode-inspector intent via metadata. */
export default function InvisibleCharInspectorPage() {
  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: PAGE.h1,
          url: `https://emojiquick.com${PAGE.path}`,
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web browser",
          description: PAGE.description,
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Tools", path: "/tools/invisible-characters" },
          { name: PAGE.h1, path: PAGE.path },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">{PAGE.h1}</h1>
        <p className="text-muted">{PAGE.intro}</p>
      </header>
      <InvisibleCharToolNav active="inspector" />
      <InvisibleCharInspectorPanel />
      <Link href="/tools/invisible-characters/cleaner" className="pill-link text-sm">
        Remove selected characters →
      </Link>
    </div>
  );
}
