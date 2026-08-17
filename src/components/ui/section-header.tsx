import Link from "next/link";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: { href: string; label: string };
}

export function SectionHeader({ title, description, eyebrow, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div className="section-header__content">
        {eyebrow ? <p className="section-header__eyebrow">{eyebrow}</p> : null}
        <h2 className="section-header__title">{title}</h2>
        {description ? <p className="section-header__description">{description}</p> : null}
      </div>
      {action ? <Link href={action.href} className="pill-link shrink-0">{action.label}</Link> : null}
    </div>
  );
}