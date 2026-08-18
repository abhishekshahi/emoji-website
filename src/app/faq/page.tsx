import type { Metadata } from "next";
import Link from "next/link";
import { HubLayout } from "@/components/hub/hub-layout";
import { JsonLd } from "@/components/seo/json-ld";
import { GLOBAL_FAQ_SECTIONS } from "@/lib/content/faq/global-faq";
import { createPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/site/config";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji FAQ",
  description: "Frequently asked questions about emojis, Unicode, copying, searching, and EmojiQuick.",
  path: "/faq",
});

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GLOBAL_FAQ_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    ),
  };

  return (
    <HubLayout
      path="/faq"
      title="Emoji FAQ"
      description="Answers to common questions about emojis, Unicode, copying, artwork, and using EmojiQuick."
      eyebrow="FAQ"
      links={[
        { href: "/emoji-guide", label: "Emoji guide" },
        { href: "/emoji-search-guide", label: "Search guide" },
        { href: "/emoji-copy-guide", label: "Copy guide" },
      ]}
    >
      <JsonLd data={faqJsonLd} />
      {GLOBAL_FAQ_SECTIONS.map((section) => (
        <section key={section.id} className="card-surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <dl className="space-y-4">
            {section.items.map((item) => (
              <div key={item.id}>
                <dt className="font-medium text-foreground">{item.question}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{item.answer}</dd>
                {item.relatedSlugs?.map((slug) => (
                  <dd key={slug} className="mt-2">
                    <Link href={`/emoji/${slug}`} className="text-sm text-accent-strong underline">
                      View {slug} emoji →
                    </Link>
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="text-xs text-muted">
        {SITE_NAME} — editorial FAQ content is clearly labeled and separate from official Unicode/CLDR data.
      </p>
    </HubLayout>
  );
}
