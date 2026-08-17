import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ChipVariant = "default" | "active" | "outline" | "soft";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant;
  children: ReactNode;
}

interface ChipLinkProps { href: string; variant?: ChipVariant; children: ReactNode; className?: string; }

function chipClass(variant: ChipVariant, className?: string): string {
  const v = variant === "active" ? "chip--active" : variant === "outline" ? "chip--outline" : variant === "soft" ? "chip--soft" : "";
  return ["chip", v, className].filter(Boolean).join(" ");
}

export function Chip({ variant = "default", className, children, type = "button", ...props }: ChipProps) {
  return <button type={type} className={chipClass(variant, className)} {...props}>{children}</button>;
}

export function ChipLink({ href, variant = "default", className, children }: ChipLinkProps) {
  return <Link href={href} className={chipClass(variant, className)}>{children}</Link>;
}