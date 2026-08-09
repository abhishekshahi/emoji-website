import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildProductionQaPackage } from "../../src/lib/master/integration/seo-migration-production-qa/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const qaDir = join(rootDir, "src", "data", "master", "integration", "seo-migration-production-qa");
const PORT = process.env.SEO_QA_PORT ?? "3099";
const BASE_URL = process.env.SEO_QA_BASE_URL ?? `http://localhost:${PORT}`;

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function waitForServer(url: string, attempts = 90): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

async function startServer(): Promise<ChildProcess> {
  const child = spawn("npm", ["run", "start", "--", "-p", PORT], {
    cwd: rootDir,
    shell: true,
    stdio: "ignore",
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  });
  await waitForServer(BASE_URL);
  return child;
}

function stopServer(child: ChildProcess | null): void {
  if (child && !child.killed) {
    child.kill();
  }
}

async function main(): Promise<void> {
  let server: ChildProcess | null = null;
  const useExternalBaseUrl = Boolean(process.env.SEO_QA_BASE_URL);

  try {
    if (!useExternalBaseUrl) {
      server = await startServer();
    }

    const qaPackage = await buildProductionQaPackage(BASE_URL, rootDir);

    writeJson(join(qaDir, "production-qa-audit.json"), qaPackage.productionQaAudit);
    writeJson(join(qaDir, "http-redirect-audit.json"), qaPackage.httpRedirectAudit);
    writeJson(join(qaDir, "redirect-status-audit.json"), qaPackage.redirectStatusAudit);
    writeJson(join(qaDir, "location-header-audit.json"), qaPackage.locationHeaderAudit);
    writeJson(join(qaDir, "redirect-exhaustive-audit.json"), qaPackage.redirectExhaustiveAudit);
    writeJson(join(qaDir, "redirect-chain-audit.json"), qaPackage.redirectChainAudit);
    writeJson(join(qaDir, "preserved-url-http-audit.json"), qaPackage.preservedUrlHttpAudit);
    writeJson(join(qaDir, "excluded-url-audit.json"), qaPackage.excludedUrlAudit);
    writeJson(join(qaDir, "canonical-http-audit.json"), qaPackage.canonicalHttpAudit);
    writeJson(join(qaDir, "sitemap-production-audit.json"), qaPackage.sitemapProductionAudit);
    writeJson(join(qaDir, "emoji-url-matrix-audit.json"), qaPackage.emojiUrlMatrixAudit);
    writeJson(join(qaDir, "query-parameter-audit.json"), qaPackage.queryParameterAudit);
    writeJson(join(qaDir, "redirect-security-audit.json"), qaPackage.redirectSecurityAudit);
    writeJson(join(qaDir, "redirect-performance-audit.json"), qaPackage.redirectPerformanceAudit);
    writeJson(join(qaDir, "redirect-bundle-audit.json"), qaPackage.redirectBundleAudit);
    writeJson(join(qaDir, "rollback-audit.json"), qaPackage.rollbackAudit);
    writeJson(join(qaDir, "production-safety-audit.json"), qaPackage.productionSafetyAudit);
    writeJson(join(qaDir, "production-qa-manifest.json"), qaPackage.productionQaManifest);

    console.log("Phase 8.12D SEO migration production QA package built.");
    console.log(`Production QA audit: ${qaPackage.productionQaAudit.status}`);
    console.log(`Conclusion: ${qaPackage.productionQaAudit.conclusion}`);

    if (qaPackage.productionQaAudit.status !== "PASS") {
      process.exitCode = 1;
    }
  } finally {
    stopServer(server);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
