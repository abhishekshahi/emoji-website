import { listPublishedCollections } from "../collections/registry";
import { listPublishedCombinations } from "../combinations/registry";
import { listMeanings } from "../meaning/registry";
import { TOPIC_SLUGS } from "@/lib/hub/hub-routes";

export interface ContentGraphNode {
  readonly id: string;
  readonly kind: "topic" | "collection" | "emoji" | "combination" | "meaning";
  readonly slug: string;
  readonly href: string;
}

export interface ContentGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: "contains" | "relates" | "references" | "topic_of";
}

export function buildContentGraph(): { nodes: ContentGraphNode[]; edges: ContentGraphEdge[] } {
  const nodes: ContentGraphNode[] = [];
  const edges: ContentGraphEdge[] = [];

  for (const topic of TOPIC_SLUGS) {
    const id = `topic:${topic}`;
    nodes.push({ id, kind: "topic", slug: topic, href: `/topics/${topic}` });
  }

  for (const collection of listPublishedCollections()) {
    const id = `collection:${collection.slug}`;
    nodes.push({ id, kind: "collection", slug: collection.slug, href: `/collections/${collection.slug}` });
    if (collection.topicSlug) {
      edges.push({ from: id, to: `topic:${collection.topicSlug}`, relation: "topic_of" });
    }
    for (const slug of collection.emojiSlugs) {
      const emojiId = `emoji:${slug}`;
      if (!nodes.some((n) => n.id === emojiId)) {
        nodes.push({ id: emojiId, kind: "emoji", slug, href: `/emoji/${slug}` });
      }
      edges.push({ from: id, to: emojiId, relation: "contains" });
    }
    for (const comboSlug of collection.relatedCombinationSlugs ?? []) {
      edges.push({ from: id, to: `combination:${comboSlug}`, relation: "references" });
    }
  }

  for (const combo of listPublishedCombinations()) {
    const id = `combination:${combo.slug}`;
    nodes.push({ id, kind: "combination", slug: combo.slug, href: `/combinations/${combo.slug}` });
    for (const slug of combo.emojiIds) {
      edges.push({ from: id, to: slug, relation: "contains" });
    }
  }

  for (const meaning of listMeanings()) {
    const id = `meaning:${meaning.slug}`;
    nodes.push({ id, kind: "meaning", slug: meaning.slug, href: `/emoji/${meaning.slug}` });
    edges.push({ from: id, to: `emoji:${meaning.slug}`, relation: "relates" });
  }

  return { nodes, edges };
}

export function getCollectionsForEmojiSlug(slug: string): readonly string[] {
  return listPublishedCollections()
    .filter((c) => c.emojiSlugs.includes(slug))
    .map((c) => c.slug);
}

export function getCombinationsForEmojiSlug(slug: string): readonly string[] {
  return listPublishedCombinations()
    .filter((c) =>
      c.emojiIds.some((id) =>
        id.toLowerCase().includes(slug.replace(/-/g, "").slice(0, 4)),
      ) || c.title.toLowerCase().includes(slug.replace(/-/g, " ")),
    )
    .map((c) => c.slug);
}
