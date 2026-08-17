import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { canonicalUrl } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/site/config";

interface HubLayoutProps {
  path: string;
  title: string;
  description: string;
  eyebrow?: string;
  children: React.ReactNode;
  links?: readonly { href: string; label: string }[];
}

export function HubLayout({
  path,
  title,
  description,
  eyebrow = "EmojiQuick",
  children,
  links = [],
}: HubLayoutProps) {
  const pageUrl = canonicalUrl(path);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: pageUrl,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: canonicalUrl("/") },
  };

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: title, path },
        ]}
      />
      <header className="space-y-3">
        <p className="section-header__eyebrow">{eyebrow}</p>
        <h1 className="text-display">{title}</h1>
        <p className="text-lead max-w-3xl">{description}</p>
      </header>
      {links.length > 0 ? (
        <nav aria-label="Related pages" className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="pill-link">
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {children}
    </div>
  );
}
