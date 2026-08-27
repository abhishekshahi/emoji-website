import Link from "next/link";
import { listInvisibleToolPages } from "@/lib/tools/invisible-characters/registry";

export function InvisibleCharToolNav({ active }: { active?: string }) {
  const pages = listInvisibleToolPages();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Invisible character tools">
      <Link
        href="/tools/invisible-characters"
        className={active === "index" ? "chip ring-2 ring-accent" : "chip"}
      >
        Overview
      </Link>
      {pages.map((p) => (
        <Link
          key={p.slug}
          href={p.path}
          className={active === p.slug ? "chip ring-2 ring-accent" : "chip"}
        >
          {p.h1.replace(/^./, (c) => c.toUpperCase())}
        </Link>
      ))}
    </nav>
  );
}
