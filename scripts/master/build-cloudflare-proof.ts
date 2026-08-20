import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCloudflareProofPackage,
  collectAssetMetrics,
  type CloudflareBuildMetrics,
  type CloudflareDeploymentResult,
} from "../../src/lib/master/integration/cloudflare-proof/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseDryRunSizes(output: string): { rawKiB: number | null; gzipKiB: number | null } {
  const match = output.match(/Total Upload:\s*([\d.]+)\s*KiB\s*\/\s*gzip:\s*([\d.]+)\s*KiB/i);
  if (!match) {
    return { rawKiB: null, gzipKiB: null };
  }
  return { rawKiB: Number(match[1]), gzipKiB: Number(match[2]) };
}

function gitValue(command: string): string | null {
  try {
    return execSync(command, { cwd: rootDir, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

function isAuthenticated(): boolean {
  try {
    const output = execSync("npx wrangler whoami", { cwd: rootDir, encoding: "utf8" });
    return !/not authenticated/i.test(output);
  } catch {
    return false;
  }
}

function wslAvailable(): boolean {
  try {
    execSync("wsl --status", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const assetMetrics = collectAssetMetrics(rootDir);
  let dryRunOutput = "";
  try {
    dryRunOutput = execSync("npx wrangler deploy --dry-run", {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_LFS_SKIP_SMUDGE: "1",
        MASTER_SEO_ROLLOUT_MODE: "OFF",
      },
    });
  } catch (error) {
    dryRunOutput = error instanceof Error && "stdout" in error ? String((error as { stdout?: string }).stdout ?? "") : "";
  }
  const sizes = parseDryRunSizes(dryRunOutput);

  const metrics: CloudflareBuildMetrics = Object.freeze({
    success: Boolean(process.env.CLOUDFLARE_BUILD_SUCCESS === "1" || dryRunOutput.includes("Total Upload")),
    durationSeconds: process.env.CLOUDFLARE_BUILD_SECONDS ? Number(process.env.CLOUDFLARE_BUILD_SECONDS) : null,
    workerGzipKiB: sizes.gzipKiB,
    workerRawKiB: sizes.rawKiB,
    staticAssetCount: assetMetrics.count || null,
    staticAssetTotalBytes: assetMetrics.totalBytes || null,
    largestAssetName: assetMetrics.largestName,
    largestAssetBytes: assetMetrics.largestBytes,
    warnings: Object.freeze([
      ...(wslAvailable() ? [] : ["WSL not available; Windows OpenNext build used"]),
      "OpenNext Windows compatibility warning may apply",
    ]),
    platform: process.platform,
    wslAvailable: wslAvailable(),
    lfsSkipSmudge: process.env.GIT_LFS_SKIP_SMUDGE === "1",
    rolloutMode: process.env.MASTER_SEO_ROLLOUT_MODE?.trim() || "OFF",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || null,
  });

  const authenticated = isAuthenticated();
  let deployment: CloudflareDeploymentResult = Object.freeze({
    attempted: false,
    success: false,
    workersDevUrl: process.env.CLOUDFLARE_PROOF_BASE_URL?.trim() || null,
    versionId: null,
    deploymentId: null,
    commit: gitValue("git rev-parse HEAD"),
    branch: gitValue("git branch --show-current"),
    authenticated,
    blocker: authenticated ? null : "Run `npx wrangler login` or set CLOUDFLARE_API_TOKEN",
    env: Object.freeze({
      MASTER_SEO_ROLLOUT_MODE: "OFF",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "",
    }),
  });

  if (authenticated && process.env.CLOUDFLARE_SKIP_DEPLOY !== "1") {
    deployment = Object.freeze({
      ...deployment,
      attempted: true,
    });
    try {
      const deployOutput = execSync("npx opennextjs-cloudflare deploy", {
        cwd: rootDir,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_LFS_SKIP_SMUDGE: "1",
          MASTER_SEO_ROLLOUT_MODE: "OFF",
        },
      });
      const urlMatch = deployOutput.match(/https:\/\/[a-z0-9-]+\.workers\.dev/i);
      deployment = Object.freeze({
        ...deployment,
        success: true,
        workersDevUrl: urlMatch?.[0] ?? deployment.workersDevUrl,
        deploymentId: deployOutput.match(/Current Version ID:\s*([^\s]+)/i)?.[1] ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deployment = Object.freeze({
        ...deployment,
        success: false,
        blocker: message,
      });
    }
  }

  const proofPackage = await buildCloudflareProofPackage({
    rootDir,
    metrics,
    deployment,
  });

  for (const [filename, payload] of Object.entries(proofPackage.artifacts)) {
    writeJson(join(proofPackage.cloudflareProofIntegrationDir, filename), payload);
  }

  console.log(JSON.stringify({
    decision: proofPackage.decision,
    workersDevUrl: deployment.workersDevUrl,
    authenticated,
    workerGzipKiB: metrics.workerGzipKiB,
    staticAssetCount: metrics.staticAssetCount,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
