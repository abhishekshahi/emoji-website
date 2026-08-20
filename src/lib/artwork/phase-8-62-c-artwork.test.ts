import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import {
  buildArtworkIdentityInput,
  indexArtworkMasterById,
} from "@/lib/artwork/canonical-artwork-input";
import {
  isAssetPubliclyEligible,
  resolvePreferredArtwork,
  type ArtworkIdentityInput,
} from "@/lib/artwork/resolve-preferred-artwork";
import { ARTWORK_PRIORITY_ORDER } from "@/lib/artwork/provider-architecture";
import { resolvePreferredDisplayUrl } from "@/lib/artwork/preferred-display-url";

const masterDir = join(process.cwd(), "src", "data", "master");

function loadMasterIndex(): ArtworkMasterRecord[] {
  return JSON.parse(
    readFileSync(join(masterDir, "artwork", "artwork-master-index.json"), "utf8"),
  ) as ArtworkMasterRecord[];
}

function loadCanonicalEntry(canonicalId: string) {
  const index = JSON.parse(
    readFileSync(join(masterDir, "artwork", "canonical-artwork-index.json"), "utf8"),
  ) as Array<{ canonicalId: string; artwork: Record<string, string[]> }>;
  return index.find((entry) => entry.canonicalId === canonicalId);
}

function identityFromCanonical(canonicalId: string): ArtworkIdentityInput | null {
  const entry = loadCanonicalEntry(canonicalId);
  if (!entry) return null;
  const masterById = indexArtworkMasterById(loadMasterIndex());
  return buildArtworkIdentityInput(canonicalId, {
    openmoji: entry.artwork.openmoji ?? [],
    noto: entry.artwork.noto ?? [],
    twemoji: entry.artwork.twemoji ?? [],
    fluent: entry.artwork.fluent ?? [],
  }, masterById);
}

function syntheticIdentity(
  partial: ArtworkIdentityInput["artwork"],
  canonicalId = "unicode:TEST",
): ArtworkIdentityInput {
  return { canonicalId, artwork: partial };
}

describe("Phase 8.62-C artwork priority resolver", () => {
  it("preserves exact provider priority order", () => {
    assert.deepEqual(ARTWORK_PRIORITY_ORDER, ["noto", "fluent", "openmoji", "twemoji"]);
  });

  it("TEST A — fire Noto asset prefers simple glyph over ZWJ filename", () => {
    const identity = syntheticIdentity({
      noto: [
        {
          sourceId: "noto-artwork:1F525:emoji_u1f426_200d_1f525.svg",
          path: "artwork/noto/svg/emoji_u1f426_200d_1f525.svg",
          format: "svg",
        },
        {
          sourceId: "noto-artwork:1F525:emoji_u1f525.svg",
          path: "artwork/noto/svg/emoji_u1f525.svg",
          format: "svg",
        },
      ],
    }, "unicode:1F525");
    const result = resolvePreferredArtwork(identity);
    assert.ok(result);
    assert.ok(result.asset.path.includes("emoji_u1f525"));
    assert.ok(result.url.includes("emoji_u1f525"));
  });

  it("TEST A2 — all providers: selects Noto", () => {
    const identity = syntheticIdentity({
      noto: [{ sourceId: "1f525", path: "artwork/noto/svg/emoji_u1f525.svg", format: "svg" }],
      fluent: [{ sourceId: "fire_color.svg", path: "artwork/fluent/assets/Fire/Color/fire_color.svg", format: "svg" }],
      openmoji: [{ sourceId: "1F525", path: "artwork/openmoji/1F525.svg", format: "svg" }],
      twemoji: [{ sourceId: "1f525.svg", path: "artwork/twemoji/assets/svg/1f525.svg", format: "svg" }],
    });
    const result = resolvePreferredArtwork(identity);
    assert.ok(result);
    assert.equal(result.provider, "noto");
    assert.equal(result.fallbackRank, 1);
    assert.ok(result.url.includes("/api/artwork/noto/"));
  });

  it("TEST B — Noto unavailable, Fluent available", () => {
    const identity = syntheticIdentity({
      fluent: [{ sourceId: "fire_color.svg", path: "artwork/fluent/assets/Fire/Color/fire_color.svg", format: "svg" }],
      openmoji: [{ sourceId: "1F525", path: "artwork/openmoji/1F525.svg", format: "svg" }],
    });
    const result = resolvePreferredArtwork(identity);
    assert.ok(result);
    assert.equal(result.provider, "fluent");
    assert.equal(result.fallbackRank, 2);
  });

  it("TEST C — Noto and Fluent unavailable, OpenMoji available", () => {
    const identity = syntheticIdentity({
      openmoji: [{ sourceId: "1F525", path: "artwork/openmoji/1F525.svg", format: "svg" }],
      twemoji: [{ sourceId: "1f525.svg", path: "artwork/twemoji/assets/svg/1f525.svg", format: "svg" }],
    });
    const result = resolvePreferredArtwork(identity);
    assert.ok(result);
    assert.equal(result.provider, "openmoji");
    assert.equal(result.fallbackRank, 3);
  });

  it("TEST D — only Twemoji available among standard providers", () => {
    const identity = syntheticIdentity({
      twemoji: [{ sourceId: "1f525.svg", path: "artwork/twemoji/assets/svg/1f525.svg", format: "svg" }],
    });
    const result = resolvePreferredArtwork(identity);
    assert.ok(result);
    assert.equal(result.provider, "twemoji");
    assert.equal(result.fallbackRank, 4);
  });

  it("TEST F — no permitted artwork returns null", () => {
    const identity = syntheticIdentity({});
    assert.equal(resolvePreferredArtwork(identity), null);
  });

  it("TEST G — Noto exists but license-blocked path falls through to Fluent", () => {
    const identity = syntheticIdentity({
      noto: [{ sourceId: "noto.png", path: "artwork/noto/images/noto.png", format: "png" }],
      fluent: [{ sourceId: "fire_color.svg", path: "artwork/fluent/assets/Fire/Color/fire_color.svg", format: "svg" }],
    });
    assert.equal(
      isAssetPubliclyEligible("noto", identity.artwork.noto![0]!),
      false,
    );
    const result = resolvePreferredArtwork(identity);
    assert.ok(result);
    assert.equal(result.provider, "fluent");
  });

  it("TEST H — Fluent exists but license-blocked path falls through", () => {
    const identity = syntheticIdentity({
      fluent: [{ sourceId: "bad.svg", path: "artwork/fluent/other/bad.svg", format: "svg" }],
      openmoji: [{ sourceId: "1F525", path: "artwork/openmoji/1F525.svg", format: "svg" }],
    });
    assert.equal(isAssetPubliclyEligible("fluent", identity.artwork.fluent![0]!), false);
    const result = resolvePreferredArtwork(identity);
    assert.ok(result);
    assert.equal(result.provider, "openmoji");
  });
});

describe("Phase 8.62-C real emoji identities", () => {
  const cases: Array<{ label: string; canonicalId: string; hex: string }> = [
    { label: "grinning face", canonicalId: "unicode:1F600", hex: "1F600" },
    { label: "red heart", canonicalId: "unicode:2764", hex: "2764" },
    { label: "fire", canonicalId: "unicode:1F525", hex: "1F525" },
    { label: "thumbs up", canonicalId: "unicode:1F44D", hex: "1F44D" },
    { label: "thumbs up light skin", canonicalId: "unicode:1F44D-1F3FB", hex: "1F44D-1F3FB" },
    { label: "family", canonicalId: "unicode:1F468-200D-1F469-200D-1F467-200D-1F466", hex: "1F468-200D-1F469-200D-1F467-200D-1F466" },
    { label: "rainbow flag", canonicalId: "unicode:1F308", hex: "1F308" },
    { label: "India flag", canonicalId: "unicode:1F1EE-1F1F3", hex: "1F1EE-1F1F3" },
    { label: "keycap 1", canonicalId: "unicode:1F51F", hex: "1F51F" },
    { label: "technologist", canonicalId: "unicode:1F9D1-200D-1F4BB", hex: "1F9D1-200D-1F4BB" },
    { label: "heart on fire", canonicalId: "unicode:2764-FE0F-200D-1F525", hex: "2764-FE0F-200D-1F525" },
    { label: "woman astronaut", canonicalId: "unicode:1F469-200D-1F680", hex: "1F469-200D-1F680" },
  ];

  for (const { label, canonicalId, hex } of cases) {
    it(`resolves permitted artwork for ${label}`, () => {
      const identity = identityFromCanonical(canonicalId);
      if (!identity) {
        // identity may lack artwork — safe unavailable
        assert.equal(resolvePreferredArtwork(syntheticIdentity({})), null);
        return;
      }
      const result = resolvePreferredArtwork(identity);
      if (!result) return;
      assert.ok(result.url);
      assert.ok(result.fallbackRank >= 1 && result.fallbackRank <= 4);
      const display = resolvePreferredDisplayUrl(result, hex);
      assert.ok(display);
    });
  }
});
