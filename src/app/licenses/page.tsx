import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { createPageMetadata } from "@/lib/seo/metadata";
import { LICENSE_REGISTRY, getLicenseRegistrySummary } from "@/lib/master/public/license-registry";
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
    "Third-party licenses and attribution for emoji artwork and data used by EmojiQuick.",
  path: "/licenses",
});

export default function LicensesPage() {
  const registrySummary = getLicenseRegistrySummary();

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
          EmojiQuick is not affiliated with, endorsed by, or sponsored by OpenMoji.
          Artwork files are served locally from this website under{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
            public/openmoji/
          </code>{" "}
          and are not hotlinked from third-party servers.
        </p>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">OpenMoji Extras artwork</h2>
        <p className="text-muted">
          OpenMoji Extras are additional symbols and designs beyond the standard
          Unicode emoji set. They are provided by{" "}
          <Link href={OPENMOJI_PROJECT_URL} className="text-accent-strong underline">
            OpenMoji
          </Link>{" "}
          under{" "}
          <Link href={OPENMOJI_LICENSE_URL} className="text-accent-strong underline">
            {OPENMOJI_LICENSE}
          </Link>
          .
        </p>
        <p className="text-muted">
          Individual OpenMoji Extra designs credit their authors on each emoji
          detail page. When sharing or redistributing OpenMoji artwork, you must
          provide attribution and share under the same license.
        </p>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Unicode &amp; metadata sources</h2>
        <p className="text-muted">
          Emoji names, categories, keywords, meanings, and Unicode information are enriched from official Unicode data and additional metadata sources indexed in the master database.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Unicode emoji data (Unicode Terms of Use)</li>
          <li>CLDR / Emojibase annotations (MIT / Unicode Terms of Use)</li>
          <li>Emojilib keywords (MIT)</li>
          <li>EmojiNet definitions (CC BY-NC-SA 4.0 — used for on-page meaning where available)</li>
          <li>OpenMoji tags and annotations (CC BY-SA 4.0)</li>
        </ul>
        <p className="text-sm text-muted">
          OpenMoji and Twemoji artwork may be publicly served when the master platform is enabled, subject to CC BY-SA 4.0 and CC BY 4.0 attribution requirements. Noto and Fluent artwork remain indexed but private until per-asset license verification is complete.
        </p>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">License registry</h2>
        <p className="text-sm text-muted">
          Formal provider and source license audit ({registrySummary.totalEntries} entries:{" "}
          {registrySummary.verified} verified, {registrySummary.partial} partial,{" "}
          {registrySummary.unverified} unverified, {registrySummary.restricted} restricted).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-semibold">Provider</th>
                <th className="py-2 pr-4 font-semibold">Asset type</th>
                <th className="py-2 pr-4 font-semibold">License</th>
                <th className="py-2 pr-4 font-semibold">Public serve</th>
                <th className="py-2 font-semibold">Download</th>
              </tr>
            </thead>
            <tbody>
              {LICENSE_REGISTRY.map((entry) => (
                <tr key={`${entry.provider}-${entry.assetType}`} className="border-b border-border/60">
                  <td className="py-2 pr-4">{entry.provider}</td>
                  <td className="py-2 pr-4 text-muted">{entry.assetType}</td>
                  <td className="py-2 pr-4">
                    <Link href={entry.licenseURL} className="text-accent-strong underline">
                      {entry.license}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{entry.publicServingAllowed ? "Yes" : "No"}</td>
                  <td className="py-2">{entry.publicDownloadAllowed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Application code</h2>
        <p className="text-muted">
          The EmojiQuick application code is separate from third-party artwork
          licensing. See the repository for application licensing details.
        </p>
      </section>
    </div>
  );
}
