import type { EnrichmentArtworkProvider } from "./enrichment-types";

export type ArtworkFormat = "svg" | "png" | "other";

export interface ArtworkProviderIntel {
  readonly provider: EnrichmentArtworkProvider;
  readonly indexed: boolean;
  readonly publiclyServed: boolean;
  readonly formats: readonly ArtworkFormat[];
  readonly assetCount: number;
  readonly license: string;
  readonly status: "available" | "indexed" | "missing";
}

export interface ArtworkIntelSummary {
  readonly primaryProvider: EnrichmentArtworkProvider;
  readonly providerCount: number;
  readonly providers: readonly ArtworkProviderIntel[];
}

const PROVIDER_LICENSES: Record<EnrichmentArtworkProvider, string> = {
  openmoji: "CC BY-SA 4.0",
  noto: "Apache 2.0 / OFL",
  twemoji: "CC BY 4.0",
  fluent: "MIT",
};

const PUBLICLY_SERVED: Record<EnrichmentArtworkProvider, boolean> = {
  openmoji: true,
  noto: false,
  twemoji: false,
  fluent: false,
};

function detectFormats(paths: readonly string[]): ArtworkFormat[] {
  const formats = new Set<ArtworkFormat>();
  for (const path of paths) {
    const lower = path.toLowerCase();
    if (lower.endsWith(".svg")) formats.add("svg");
    else if (lower.endsWith(".png")) formats.add("png");
    else formats.add("other");
  }
  return [...formats];
}

function uniqueAssetCount(paths: readonly string[]): number {
  return new Set(paths).size;
}

export function buildArtworkIntelSummary(input: {
  openmoji: readonly string[];
  noto: readonly string[];
  twemoji: readonly string[];
  fluent: readonly string[];
  openmojiPubliclyAvailable: boolean;
}): ArtworkIntelSummary {
  const providerData: Array<{
    provider: EnrichmentArtworkProvider;
    paths: readonly string[];
    publiclyServed: boolean;
  }> = [
    {
      provider: "openmoji",
      paths: input.openmoji,
      publiclyServed: input.openmojiPubliclyAvailable && PUBLICLY_SERVED.openmoji,
    },
    { provider: "noto", paths: input.noto, publiclyServed: PUBLICLY_SERVED.noto },
    { provider: "twemoji", paths: input.twemoji, publiclyServed: PUBLICLY_SERVED.twemoji },
    { provider: "fluent", paths: input.fluent, publiclyServed: PUBLICLY_SERVED.fluent },
  ];

  const providers: ArtworkProviderIntel[] = providerData.map(({ provider, paths, publiclyServed }) => {
    const assetCount = uniqueAssetCount(paths);
    const indexed = assetCount > 0;
    const formats = detectFormats(paths);

    let status: ArtworkProviderIntel["status"] = "missing";
    if (publiclyServed && indexed) status = "available";
    else if (indexed) status = "indexed";

    return {
      provider,
      indexed,
      publiclyServed,
      formats,
      assetCount,
      license: PROVIDER_LICENSES[provider],
      status,
    };
  });

  const indexedProviders = providers.filter((provider) => provider.indexed);
  const primaryProvider =
    indexedProviders.find((provider) => provider.publiclyServed)?.provider ??
    indexedProviders[0]?.provider ??
    "openmoji";

  return {
    primaryProvider,
    providerCount: indexedProviders.length,
    providers,
  };
}

export function compactArtworkForRecord(summary: ArtworkIntelSummary): {
  primary: EnrichmentArtworkProvider;
  count: number;
  p: Record<string, { f: ArtworkFormat[]; n: number; s: boolean }>;
} {
  const p: Record<string, { f: ArtworkFormat[]; n: number; s: boolean }> = {};
  for (const provider of summary.providers) {
    if (!provider.indexed) continue;
    p[provider.provider] = {
      f: [...provider.formats],
      n: provider.assetCount,
      s: provider.publiclyServed,
    };
  }
  return {
    primary: summary.primaryProvider,
    count: summary.providerCount,
    p,
  };
}

export function expandArtworkFromRecord(
  compact:
    | {
        readonly primary: EnrichmentArtworkProvider;
        readonly count: number;
        readonly p: Readonly<
          Record<
            string,
            {
              readonly f: readonly ArtworkFormat[];
              readonly n: number;
              readonly s: boolean;
            }
          >
        >;
      }
    | undefined,
): ArtworkIntelSummary {
  if (!compact) {
    return buildArtworkIntelSummary({
      openmoji: [],
      noto: [],
      twemoji: [],
      fluent: [],
      openmojiPubliclyAvailable: false,
    });
  }

  const providers = (Object.keys(compact.p) as EnrichmentArtworkProvider[]).map((provider) => {
    const entry = compact.p[provider];
    const publiclyServed = entry.s;
    const indexed = entry.n > 0;
    return {
      provider,
      indexed,
      publiclyServed,
      formats: entry.f,
      assetCount: entry.n,
      license: PROVIDER_LICENSES[provider],
      status: publiclyServed && indexed ? "available" : indexed ? "indexed" : "missing",
    } as ArtworkProviderIntel;
  });

  return {
    primaryProvider: compact.primary,
    providerCount: compact.count,
    providers,
  };
}
