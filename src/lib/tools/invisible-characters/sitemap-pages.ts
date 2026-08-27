import { INVISIBLE_TOOL_SLUGS, INVISIBLE_TOOLS_INDEX } from "./registry";

export interface IndexableInvisibleToolPage {
  readonly path: string;
  readonly kind: "index" | "tool";
}

export function getIndexableInvisibleToolPages(): IndexableInvisibleToolPage[] {
  const pages: IndexableInvisibleToolPage[] = [
    { path: INVISIBLE_TOOLS_INDEX.path, kind: "index" },
  ];
  for (const slug of INVISIBLE_TOOL_SLUGS) {
    pages.push({ path: `/tools/invisible-characters/${slug}`, kind: "tool" });
  }
  return pages;
}
