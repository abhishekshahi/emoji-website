import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

/** Legacy collection URL → paginated route (page 1). */
export default async function KaomojiCollectionRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/kaomoji/collections/${slug}/page/1`);
}
