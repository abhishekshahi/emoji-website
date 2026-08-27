import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { InvisibleCharGeneratorPanel } from "@/components/tools/invisible-char-generator-panel";
import { InvisibleCharToolNav } from "@/components/tools/invisible-char-tool-nav";
import { getInvisibleToolPage } from "@/lib/tools/invisible-characters/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

const PAGE = getInvisibleToolPage("generator")!;

export const metadata: Metadata = createPageMetadata({
  title: PAGE.title,
  description: PAGE.description,
  path: PAGE.path,
});

export default function InvisibleCharGeneratorPage() {
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
      <InvisibleCharToolNav active="generator" />
      <InvisibleCharGeneratorPanel />
      <Link href="/tools/invisible-characters/inspector" className="pill-link text-sm">
        Inspect pasted text →
      </Link>
    </div>
  );
}
