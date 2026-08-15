import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, beforeEach } from "node:test";
import { MASTER_INTEGRATION_CONFIG } from "@/lib/master/integration/config";
import { parseMasterR2Mode } from "@/lib/master/r2/config";
import {
  identityKey,
  metadataKey,
  searchKey,
  safeCanonicalFileName,
  MasterR2Adapter,
  resetMasterR2AdapterCache,
  isArtworkPubliclyServable,
  loadLicenseMatrix,
  resetLicenseMatrixCache,
  isR2MetadataBackendActive,
  isR2SearchBackendActive,
  toPublicMasterError,
  MasterObjectNotFoundError,
} from "@/lib/r2";

const rootDir = process.cwd();
const exportRoot = join(rootDir, "r2-export");

describe("Phase 8.52 master R2 adapter", () => {
  beforeEach(() => {
    resetMasterR2AdapterCache();
    resetLicenseMatrixCache();
  });

  it("maps canonical IDs to safe object keys", () => {
    assert.equal(safeCanonicalFileName("unicode:1F525"), "unicode_1F525");
    assert.equal(identityKey("unicode:1F525"), "identities/unicode_1F525.json");
    assert.equal(metadataKey("unicode:1F525"), "metadata/unicode_1F525.json");
    assert.equal(searchKey("unicode:1F525"), "search/unicode_1F525.json");
  });

  it("reads identity from local r2-export fallback", async () => {
    if (!existsSync(join(exportRoot, "identities"))) {
      return;
    }

    const adapter = new MasterR2Adapter({ exportRoot, binding: null });
    const result = await adapter.getIdentity("unicode:1F525");
    assert.ok(result);
    assert.equal(result?.source, "local");
    assert.equal(result?.data.canonicalId, "unicode:1F525");
  });

  it("reads metadata, semantic, search, and provenance records locally", async () => {
    if (!existsSync(join(exportRoot, "search", "unicode_1F525.json"))) {
      return;
    }

    const adapter = new MasterR2Adapter({ exportRoot, binding: null });
    const search = await adapter.getSearch("unicode:1F525");
    const metadata = await adapter.getMetadata("unicode:1F525");
    const semantic = await adapter.getSemantic("unicode:1F525");
    const provenance = await adapter.getProvenance("unicode:1F525");
    assert.ok(search?.data.canonicalName);
    assert.ok(metadata?.data);
    assert.ok(semantic?.data || semantic === null);
    assert.ok(provenance?.data || provenance === null);
  });

  it("reads artwork records locally when present", async () => {
    const recordsDir = join(exportRoot, "artwork-records");
    if (!existsSync(recordsDir)) {
      return;
    }

    const sample = (await import("node:fs/promises")).readdir(recordsDir).then((files) => files[0]);
    const fileName = await sample;
    if (!fileName) return;

    const checksum = fileName.replace(/\.json$/, "");
    const adapter = new MasterR2Adapter({ exportRoot, binding: null });
    const record = await adapter.getArtworkRecord(checksum);
    assert.ok(record?.data.checksum);
  });

  it("falls back to local data when R2 binding read fails", async () => {
    if (!existsSync(join(exportRoot, "identities"))) {
      return;
    }

    const failingBinding = {
      get: async () => {
        throw new Error("R2 binding unavailable");
      },
    };

    const adapter = new MasterR2Adapter({ exportRoot, binding: failingBinding });
    const result = await adapter.getIdentity("unicode:1F525");
    assert.ok(result);
    assert.equal(result?.source, "local");
  });

  it("falls back to local data when R2 binding times out", async () => {
    if (!existsSync(join(exportRoot, "identities"))) {
      return;
    }

    const slowBinding = {
      get: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return null;
      },
    };

    const adapter = new MasterR2Adapter({
      exportRoot,
      binding: slowBinding,
      readTimeoutMs: 50,
      maxReadRetries: 0,
    });
    const result = await adapter.getIdentity("unicode:1F525");
    assert.ok(result);
    assert.equal(result?.source, "local");
  });

  it("never exposes bucket endpoints or credentials in adapter responses", async () => {
    const adapter = new MasterR2Adapter({ exportRoot, binding: null });
    const result = await adapter.getIdentity("unicode:1F525");
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("r2.cloudflarestorage.com"));
    assert.ok(!serialized.includes("emojiquick-master"));
    assert.ok(!serialized.includes("CLOUDFLARE"));
  });

  it("returns null for missing objects without throwing", async () => {
    const adapter = new MasterR2Adapter({ exportRoot, binding: null });
    const missing = await adapter.getIdentity("missing:canonical:id:xyz");
    assert.equal(missing, null);
  });

  it("enforces license matrix public serving rules", () => {
    const matrix = loadLicenseMatrix(exportRoot);
    assert.equal(isArtworkPubliclyServable("openmoji", matrix), true);
    assert.equal(isArtworkPubliclyServable("noto", matrix), false);
    assert.equal(isArtworkPubliclyServable("fluent", matrix), false);
  });

  it("keeps feature flags OFF by default", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(isR2MetadataBackendActive(), false);
    assert.equal(isR2SearchBackendActive(), false);
    assert.equal(parseMasterR2Mode(undefined), "OFF");
  });

  it("does not expose internal errors publicly", () => {
    const pub = toPublicMasterError(new MasterObjectNotFoundError());
    assert.equal(pub.code, "NOT_FOUND");
    assert.equal(pub.message, "Not found");
  });

  it("protects against credential exposure in public env", () => {
    const envKeys = Object.keys(process.env).filter((key) => key.startsWith("NEXT_PUBLIC_"));
    for (const key of envKeys) {
      assert.ok(!key.toLowerCase().includes("r2"));
      assert.ok(!key.toLowerCase().includes("cloudflare_api"));
    }
  });

  it("loads cached public identity payload for on-demand pages", async () => {
    if (!existsSync(join(exportRoot, "search"))) {
      return;
    }

    const originalMode = process.env.MASTER_R2_MODE;
    process.env.MASTER_R2_MODE = "ENABLED";
    try {
      const { getPublicIdentityR2Payload } = await import("@/lib/r2");
      const { buildPublicIdentityResponseFromR2 } = await import("@/lib/master/public/r2-service");
      const { resolveEmojiPage } = await import("@/lib/master/public/identity-page-resolver");
      const canonicalId = "source:noto:-CA";
      const first = await getPublicIdentityR2Payload(canonicalId);
      const second = await getPublicIdentityR2Payload(canonicalId);
      assert.ok(first);
      assert.deepEqual(first, second);

      const resolved = await resolveEmojiPage("ca");
      assert.ok(resolved);
      assert.equal(resolved?.kind, "master-identity");
      assert.equal(resolved?.canonicalId, canonicalId);

      const identity = await buildPublicIdentityResponseFromR2(canonicalId);
      assert.ok(identity);
      assert.equal(identity?.semanticTerms.length, 0);
    } finally {
      if (originalMode === undefined) delete process.env.MASTER_R2_MODE;
      else process.env.MASTER_R2_MODE = originalMode;
      resetMasterR2AdapterCache();
    }
  });

  it("resolves 100 on-demand pages concurrently from local r2-export", async () => {
    if (!existsSync(join(exportRoot, "search"))) {
      return;
    }

    const originalMode = process.env.MASTER_R2_MODE;
    process.env.MASTER_R2_MODE = "ENABLED";
    try {
      const { readFileSync } = await import("node:fs");
      const { resolveEmojiPage } = await import("@/lib/master/public/identity-page-resolver");
      const slugMap = JSON.parse(
        readFileSync(join(rootDir, "src/data/master/integration/identity-slug-map.json"), "utf8"),
      ) as { entries: Array<{ slug: string }> };
      const browsable = new Set(
        JSON.parse(readFileSync(join(rootDir, "src/data/emojis.json"), "utf8")).map(
          (entry: { slug: string }) => entry.slug,
        ),
      );
      const slugs = slugMap.entries
        .map((entry) => entry.slug)
        .filter((slug) => !browsable.has(slug))
        .slice(0, 100);

      const started = Date.now();
      const results = await Promise.all(
        slugs.map(async (slug) => {
          const resolved = await resolveEmojiPage(slug);
          return { slug, ok: Boolean(resolved?.identity) };
        }),
      );
      const failed = results.filter((result) => !result.ok);
      assert.equal(failed.length, 0, `failed slugs: ${failed.slice(0, 5).map((entry) => entry.slug).join(", ")}`);
      assert.ok(Date.now() - started < 60000, "100 concurrent local resolutions took too long");
    } finally {
      if (originalMode === undefined) delete process.env.MASTER_R2_MODE;
      else process.env.MASTER_R2_MODE = originalMode;
      resetMasterR2AdapterCache();
    }
  });
});
