import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Page not found",
  description: "The requested emoji page could not be found.",
  path: "/404",
  noIndex: true,
});

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="card-surface mx-auto max-w-xl px-6 py-12 text-center">
        <p className="text-5xl" aria-hidden="true">
          🔍
        </p>
        <h1 className="mt-4 text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted">
          That emoji or page does not exist in this collection.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-on-accent"
          >
            Go home
          </Link>
          <Link href="/search" className="pill-link min-h-11">
            Search emojis
          </Link>
        </div>
      </div>
    </div>
  );
}
