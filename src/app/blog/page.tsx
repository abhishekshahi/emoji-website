import type { Metadata } from "next";
import Link from "next/link";
import { HubLayout } from "@/components/hub/hub-layout";
import { listPosts } from "@/lib/content/editorial/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Blog & Guides",
  description: "Editorial articles about emoji meanings, Unicode, search tips, and how emojis evolve.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const posts = listPosts();

  return (
    <HubLayout
      path="/blog"
      title="Emoji Blog"
      description="Editorial guides and articles from EmojiQuick about emoji culture, Unicode, and search."
      eyebrow="Editorial"
    >
      <div className="grid gap-4">
        {posts.map((post) => (
          <article key={post.slug} className="card-surface space-y-2 p-6">
            <h2 className="text-xl font-semibold">
              <Link href={`/blog/${post.slug}`} className="hover:text-accent-strong">
                {post.title}
              </Link>
            </h2>
            <p className="text-sm text-muted">{post.excerpt}</p>
          </article>
        ))}
      </div>
    </HubLayout>
  );
}
