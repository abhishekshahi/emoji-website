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
      <div className="empty-state mx-auto max-w-xl">
        <div className="flex justify-center">
          <BrandLogo variant="inline" />
        </div>
        <p className="empty-state__title mt-4">Something went wrong</p>
        <p className="empty-state__description">
          An unexpected error occurred. You can try again or return to the
          homepage.
        </p>
        <div className="empty-state__actions">
          <button
            type="button"
            onClick={() => reset()}
            className="btn btn--primary btn--md"
          >
            Try again
          </button>
          <Link href="/" className="btn btn--secondary btn--md">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
