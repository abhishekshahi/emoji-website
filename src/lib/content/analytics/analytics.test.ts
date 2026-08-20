import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANALYTICS_MATURITY } from "./events";
import { validateAnalyticsBatch, hexcodeToCanonicalId, isValidCanonicalId, containsPiiFields } from "./validation";
import { createAnalyticsEvent } from "./events";

describe("analytics privacy and validation", () => {
  it("rejects invalid canonical IDs", () => {
    assert.equal(isValidCanonicalId("not-valid"), false);
    assert.ok(isValidCanonicalId("unicode:2764"));
    assert.ok(isValidCanonicalId("unicode:1F44D-1F3FB"));
  });

  it("validates event batches without PII fields", () => {
    const valid = validateAnalyticsBatch({
      events: [{ kind: "emoji_copy", canonicalId: "unicode:2764", slug: "red-heart" }],
    });
    assert.equal(valid.length, 1);
    assert.equal(valid[0]?.kind, "emoji_copy");
  });

  it("rejects unknown event kinds", () => {
    const valid = validateAnalyticsBatch({
      events: [{ kind: "user_email", canonicalId: "unicode:2764" }],
    });
    assert.equal(valid.length, 0);
  });

  it("maps hexcode to canonical ID", () => {
    assert.equal(hexcodeToCanonicalId("2764"), "unicode:2764");
  });

  it("keeps live events disabled until threshold", () => {
    assert.equal(ANALYTICS_MATURITY.liveEventsEnabled, false);
  });

  it("creates events without PII fields", () => {
    const event = createAnalyticsEvent("emoji_view", "unicode:1F525", "fire");
    assert.equal(event.canonicalId, "unicode:1F525");
    assert.equal("email" in event, false);
  });

  it("rejects PII in batch payloads", () => {
    assert.ok(containsPiiFields({ events: [{ kind: "emoji_copy", canonicalId: "unicode:2764", email: "user@example.com" }] }));
  });
});
