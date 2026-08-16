import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/providers/client-providers";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SkipLink } from "@/components/layout/skip-link";
import {
  BRAND_FAVICON_180,
  BRAND_FAVICONS,
  BRAND_ICON,
  BRAND_OG_IMAGE,
} from "@/lib/site/brand";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site/config";
import { absoluteUrl } from "@/lib/seo/metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteOgImage = absoluteUrl(BRAND_OG_IMAGE);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Find the Perfect Emoji`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [{ url: BRAND_ICON, type: "image/svg+xml" }, ...BRAND_FAVICONS],
    apple: [{ url: BRAND_FAVICON_180, sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Find the Perfect Emoji`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: siteOgImage,
        width: 3840,
        height: 2160,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Find the Perfect Emoji`,
    description: SITE_DESCRIPTION,
    images: [siteOgImage],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ClientProviders>
          <SkipLink />
          <SiteHeader />
          <main id="main-content" className="flex-1 py-8 pb-24 md:pb-8">
            {children}
          </main>
          <SiteFooter />
          <MobileBottomNav />
        </ClientProviders>
      </body>
    </html>
  );
}
