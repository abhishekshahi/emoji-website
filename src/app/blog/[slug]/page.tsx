import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HubLayout } from "@/components/hub/hub-layout";
import { getPost, listPosts } from "@/lib/content/editorial/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return listPosts().map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Article not found" };
  return createPageMetadata({ title: post.title, description: post.excerpt, path: `/blog/${slug}` });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <HubLayout path={`/blog/${slug}`} title={post.title} description={post.excerpt} eyebrow="Article">
      {post.body.map((block, index) => (
        <section key={index} className="card-surface space-y-3 p-6">
          {block.heading ? <h2 className="text-xl font-semibold">{block.heading}</h2> : null}
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-sm leading-relaxed text-muted">{paragraph}</p>
          ))}
        </section>
      ))}
      <p className="text-sm"><Link href="/blog" className="text-accent-strong underline">← All articles</Link></p>
    </HubLayout>
  );
}
