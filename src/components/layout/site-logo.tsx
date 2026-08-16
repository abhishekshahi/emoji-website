import {
  BRAND_ICON,
  BRAND_LOGO_PRIMARY,
  BRAND_LOGO_PRIMARY_HEIGHT,
  BRAND_LOGO_PRIMARY_WEBP,
  BRAND_LOGO_PRIMARY_WIDTH,
} from "@/lib/site/brand";

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
      <picture className="hidden md:contents">
        <source srcSet={BRAND_LOGO_PRIMARY_WEBP} type="image/webp" />
        <img
          src={BRAND_LOGO_PRIMARY}
          alt="EmojiQuick"
          width={BRAND_LOGO_PRIMARY_WIDTH}
          height={BRAND_LOGO_PRIMARY_HEIGHT}
          className="hidden h-10 w-auto max-w-[min(100%,11.5rem)] shrink-0 md:block"
          decoding="async"
        />
      </picture>
    </span>
  );
}

/** Footer and compact contexts — primary logo at a smaller height. */
export function SiteLogoCompact({ className }: SiteLogoProps) {
  return (
    <picture>
      <source srcSet={BRAND_LOGO_PRIMARY_WEBP} type="image/webp" />
      <img
        src={BRAND_LOGO_PRIMARY}
        alt="EmojiQuick"
        width={BRAND_LOGO_PRIMARY_WIDTH}
        height={BRAND_LOGO_PRIMARY_HEIGHT}
        className={className ?? "h-8 w-auto max-w-[9.5rem]"}
        decoding="async"
      />
    </picture>
  );
}