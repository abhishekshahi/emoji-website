import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import {
  buildReleasePackage,
  FROZEN_MASTER_FILES,
  getDependencyVersions,
  verifyFrozenChecksums,
} from "@/lib/master/release/build";
import type { FileChecksumEntry, MasterDatabaseFrozen, MasterReleaseManifest } from "@/lib/master/release/types";

const rootDir = process.cwd();
const releaseDir = join(rootDir, "src", "data", "master", "release", "8.10");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("phase 8.10 master release freeze", () => {
  const result = buildReleasePackage(rootDir);
  const manifest = readJson<MasterReleaseManifest>(join(releaseDir, "master-release-manifest.json"));
  const frozen = readJson<MasterDatabaseFrozen>(join(rootDir, "src", "data", "master", "release", "MASTER-DATABASE-FROZEN.json"));
  const fileChecksums = readJson<FileChecksumEntry[]>(
    join(releaseDir, "master-file-checksums.json"),
  );

  it("creates frozen release manifest with verified baselines", () => {
    assert.equal(result.manifest.status, "frozen");
    assert.equal(result.manifest.phase, "8.10");
    assert.equal(manifest.canonicalIdentityCount, 6955);
    assert.equal(manifest.artworkCount, 40071);
    assert.equal(manifest.metadataCount, 42910);
    assert.equal(manifest.semanticCount, 15183);
    assert.equal(manifest.definitionCount, 17572);
    assert.equal(manifest.testCount, 126);
    assert.equal(manifest.sourceCount, 10);
  });

  it("checksums all required master database files", () => {
    assert.equal(fileChecksums.length, FROZEN_MASTER_FILES.length);
    assert.ok(fileChecksums.every((entry) => entry.sha256.length === 64));
    assert.ok(fileChecksums.every((entry) => entry.status === "verified"));
  });

  it("verifies artwork release checksums with zero failures", () => {
    assert.equal(result.artworkReleaseChecksums.totalFiles, 40071);
    assert.equal(result.artworkReleaseChecksums.missingFiles, 0);
    assert.equal(result.artworkReleaseChecksums.checksumFailures, 0);
    assert.equal(result.artworkReleaseChecksums.providers.openmoji.fileCount, 4495);
    assert.equal(result.artworkReleaseChecksums.providers.noto.fileCount, 19673);
    assert.equal(result.artworkReleaseChecksums.providers.twemoji.fileCount, 8018);
    assert.equal(result.artworkReleaseChecksums.providers.fluent.fileCount, 7885);
  });

  it("marks all locked sources as IMMUTABLE", () => {
    assert.equal(result.sourceImmutability.length, 10);
    assert.ok(result.sourceImmutability.every((entry) => entry.status === "IMMUTABLE"));
  });

  it("passes release audit matching Phase 8.9 baselines", () => {
    assert.equal(result.releaseAudit.status, "PASS");
    assert.equal(result.releaseAudit.phase89AuditPassed, true);
    assert.equal(result.releaseAudit.mismatches.length, 0);
    assert.equal(result.releaseAudit.productionSafety.status, "PASS");
  });

  it("verifies frozen byte checksums remain stable after package generation", () => {
    const verification = verifyFrozenChecksums(rootDir, fileChecksums);
    assert.equal(verification.status, "PASS");
    assert.equal(verification.mismatches.length, 0);
  });

  it("records frozen database marker", () => {
    assert.equal(frozen.status, "FROZEN");
    assert.equal(frozen.phase, "8.10");
    assert.equal(frozen.canonicalIdentities, 6955);
    assert.equal(frozen.artwork, 40071);
    assert.equal(frozen.metadata, 42910);
    assert.equal(frozen.semanticRecords, 15183);
  });

  it("does not modify production data", () => {
    assert.equal(emojis.length, 3944);
    assert.equal(extras.length, 542);
  });

  it("records dependency versions without upgrading", () => {
    const deps = getDependencyVersions(rootDir);
    assert.equal(deps.openmoji, "17.0.0");
    assert.equal(deps.emojibase, "17.0.0");
    assert.equal(deps["emojibase-data"], "17.0.0");
    assert.equal(deps.next, "16.3.0");
  });
});
