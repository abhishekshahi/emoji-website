"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BrandLogo } from "@/components/layout/site-logo";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell">
      <div className="card-surface mx-auto max-w-xl px-6 py-12 text-center">
        <div className="flex justify-center">
          <BrandLogo variant="inline" />
        </div>
        <h1 className="mt-6 text-3xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-muted">
          An unexpected error occurred. You can try again or return to the homepage.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-on-accent transition hover:bg-accent-strong"
          >
            Try again
          </button>
          <Link href="/" className="pill-link min-h-11">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
