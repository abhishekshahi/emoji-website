import {
  BRAND_LOGO_UI,
  BRAND_LOGO_UI_ASPECT_RATIO,
  BRAND_LOGO_UI_HEIGHT,
  BRAND_LOGO_UI_WEBP,
  BRAND_LOGO_UI_WIDTH,
  type BrandLogoVariant,
} from "@/lib/site/brand";

type BrandLogoProps = {
  /** header = site header; footer = site footer; inline = general branded surfaces */
  variant?: BrandLogoVariant;
  className?: string;
};

const variantClass: Record<BrandLogoVariant, string> = {
  header: "brand-logo-img brand-logo-img--header",
  footer: "brand-logo-img brand-logo-img--footer",
  inline: "brand-logo-img brand-logo-img--inline",
};

/**
 * Canonical EmojiQuick logo — complete mascot + wordmark, never cropped.
 * Uses transparent trimmed PNG derived from the official approved artwork.
 */
export function BrandLogo({ variant = "header", className }: BrandLogoProps) {
  return (
    <picture
      className={className ?? "brand-logo-picture"}
      style={{ aspectRatio: String(BRAND_LOGO_UI_ASPECT_RATIO) }}
    >
      <source srcSet={BRAND_LOGO_UI_WEBP} type="image/webp" />
      <img
        src={BRAND_LOGO_UI}
        alt=""
        width={BRAND_LOGO_UI_WIDTH}
        height={BRAND_LOGO_UI_HEIGHT}
        className={variantClass[variant]}
        decoding="async"
      />
    </picture>
  );
}

/** @deprecated Use BrandLogo — kept for existing imports */
export function SiteLogo(props: Omit<BrandLogoProps, "variant">) {
  return <BrandLogo variant="header" {...props} />;
}

/** @deprecated Use BrandLogo variant="footer" */
export function SiteLogoCompact(props: Omit<BrandLogoProps, "variant">) {
  return <BrandLogo variant="footer" {...props} />;
}
