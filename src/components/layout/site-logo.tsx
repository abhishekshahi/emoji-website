import { BRAND_ICON, BRAND_LOGO_PRIMARY } from "@/lib/site/brand";

type SiteLogoProps = {
  className?: string;
};

/** Desktop: full primary logo. Mobile: compact mascot icon. */
export function SiteLogo({ className }: SiteLogoProps) {
  return (
    <span className={className}>
      <img
        src={BRAND_ICON}
        alt=""
        aria-hidden="true"
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 md:hidden"
        decoding="async"
      />
      <img
        src={BRAND_LOGO_PRIMARY}
        alt="EmojiQuick"
        width={150}
        height={40}
        className="hidden h-10 w-auto max-w-[min(100%,12.5rem)] shrink-0 md:block"
        decoding="async"
      />
    </span>
  );
}

/** Footer and compact contexts - primary logo at a smaller height. */
export function SiteLogoCompact({ className }: SiteLogoProps) {
  return (
    <img
      src={BRAND_LOGO_PRIMARY}
      alt="EmojiQuick"
      width={120}
      height={32}
      className={className ?? "h-8 w-auto max-w-[10rem]"}
      decoding="async"
    />
  );
}