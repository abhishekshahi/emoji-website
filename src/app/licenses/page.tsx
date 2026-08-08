import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  OPENMOJI_LICENSE,
  OPENMOJI_LICENSE_URL,
  OPENMOJI_PROJECT_URL,
  OPENMOJI_REPOSITORY_URL,
  OPENMOJI_VERSION,
} from "@/lib/site/config";

export const metadata: Metadata = createPageMetadata({
  title: "Licenses & Attribution",
  description:
    "Third-party licenses and attribution for emoji artwork and data used by EmojiFind.",
  path: "/licenses",
});

export default function LicensesPage() {
  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Legal"
        title="Licenses & Attribution"
        description="Third-party artwork and data sources used by this website."
      />

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">OpenMoji artwork</h2>
        <p className="text-muted">
          Emoji artwork on this website is provided by{" "}
          <Link href={OPENMOJI_PROJECT_URL} className="text-accent-strong underline">
            OpenMoji
          </Link>{" "}
          (version {OPENMOJI_VERSION}) and is licensed under{" "}
          <Link href={OPENMOJI_LICENSE_URL} className="text-accent-strong underline">
            {OPENMOJI_LICENSE}
          </Link>
          .
        </p>
        <p className="text-muted">
          Source repository:{" "}
          <Link href={OPENMOJI_REPOSITORY_URL} className="text-accent-strong underline">
            {OPENMOJI_REPOSITORY_URL}
          </Link>
        </p>
        <p className="text-muted">
          EmojiFind is not affiliated with, endorsed by, or sponsored by OpenMoji.
          Artwork files are served locally from this website and are not hotlinked
          from third-party servers.
        </p>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Unicode & Emojibase metadata</h2>
        <p className="text-muted">
          Emoji names, categories, keywords, and Unicode information are derived
          from official Unicode data and Emojibase metadata. These sources define
          the authoritative emoji records used by the site.
        </p>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Application code</h2>
        <p className="text-muted">
          The EmojiFind application code is separate from third-party artwork
          licensing. See the repository for application licensing details.
        </p>
      </section>
    </div>
  );
}
