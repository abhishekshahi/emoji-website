import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runWrangler } from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const verificationPath = join(rootDir, "r2-export", "manifests", "r2-canary-verification.json");

async function main(): Promise<void> {
  const verification = JSON.parse(readFileSync(verificationPath, "utf8")) as {
    objects: { objectKey: string }[];
    publicAccessTest?: string;
  };

  const bucketInfo = runWrangler(["r2", "bucket", "info", "emojiquick-master"], rootDir);
  const bucketOutput = `${bucketInfo.stdout}\n${bucketInfo.stderr}`.toLowerCase();
  const publicAccessEnabled =
    bucketOutput.includes("public") &&
    (bucketOutput.includes("enabled: true") || bucketOutput.includes("public access: true"));

  let httpProbeStatus = "not_public";
  const sampleKey = verification.objects[0]?.objectKey;
  if (sampleKey) {
    const probe = await fetch(`https://emojiquick.com/${sampleKey}`, { redirect: "manual" });
    if (probe.ok && probe.headers.get("content-type")?.includes("json")) {
      httpProbeStatus = "unexpected_public";
    }
  }

  const result = {
    phase: "8.38",
    testedAt: new Date().toISOString(),
    bucketPublicAccessEnabled: publicAccessEnabled,
    productionRouteProbe: httpProbeStatus,
    r2DevPublicUrl: "not_configured",
    verdict: publicAccessEnabled || httpProbeStatus === "unexpected_public" ? "FAIL" : "PASS",
  };

  const merged = { ...JSON.parse(readFileSync(verificationPath, "utf8")), publicAccessTest: result };
  writeFileSync(verificationPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  console.log(`Private access test: ${result.verdict}`);
  console.log(`  Bucket public access: ${publicAccessEnabled ? "ENABLED (unexpected)" : "not enabled"}`);
  console.log(`  Production route probe: ${httpProbeStatus}`);

  if (result.verdict === "FAIL") {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
