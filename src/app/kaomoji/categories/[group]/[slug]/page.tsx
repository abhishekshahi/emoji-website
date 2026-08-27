import { notFound, redirect } from "next/navigation";
import { resolveNestedCategory } from "@/lib/kaomoji/seo/category-routes";

interface Props {
  params: Promise<{ group: string; slug: string }>;
}

export const dynamic = "force-dynamic";

/** Production convention: /categories/{group}/{slug} → /page/1 */
export default async function KaomojiCategorySlugRedirect({ params }: Props) {
  const { group, slug } = await params;
  const cat = resolveNestedCategory(group, slug);
  if (!cat) notFound();
  redirect(`/kaomoji/categories/${group}/${slug}/page/1`);
}
