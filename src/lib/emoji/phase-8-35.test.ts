import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getEnrichmentArtworkProviders } from "./enrichment-artwork";
import { getTestEnrichmentFile } from "./enrichment-test-helpers";
import { getSearchMatchLabel } from "./search-match";

const enrichment = getTestEnrichmentFile();

describe("enrichment artwork helpers", () => {
  it("derives artwork providers from compact artwork metadata", () => {
    const providers = getEnrichmentArtworkProviders(enrichment.bySlug.fire);
    assert.ok(providers.includes("openmoji"));
    assert.ok(providers.includes("noto"));
  });
});

describe("search match labels", () => {
  it("labels exact emoji matches highest", () => {
    assert.equal(getSearchMatchLabel(1000), "Exact emoji");
  });

  it("labels semantic enrichment matches", () => {
    assert.equal(getSearchMatchLabel(350), "Meaning match");
  });
});
