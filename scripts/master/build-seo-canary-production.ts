import { mkdirSync, writeFileSync } from "node:fs";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanaryProductionPackage } from "../../src/lib/master/integration/seo-canary-production/build";
import { probeUrl } from "../../src/lib/master/integration/seo-migration-production-qa/http-client";
import {
  buildCanaryHttpAuditPackage,
  buildOffBehaviorHttpAudit,
  buildRollbackHttpAudit,
} from "../../src/lib/master/integration/seo-canary/validation-build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const productionDir = join(rootDir, "src", "data", "master", "integration", "seo-canary-production");
const PORT = process.env.SEO_QA_PORT ?? "3099";
const BASE_URL = process.env.SEO_QA_BASE_URL ?? `http://localhost:${PORT}`;
const CANARY_ENVIRONMENT = process.env.SEO_CANARY_ENVIRONMENT ?? "local-production-like";

type RolloutEnv = "unset" | "OFF" | "CANARY";

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcessTree(child: ChildProcess | null): void {
  if (!child?.pid) {
    return;
  }
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    // process may already be gone
  }
}

function killPortListeners(port: string): void {
  if (process.platform !== "win32") {
    return;
  }
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const pids = new Set<string>();
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) {
        continue;
      }
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0") {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      } catch {
        // ignore
      }
    }
  } catch {
    // no listeners
  }
}

async function waitForPortFree(port: string, attempts = 30): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual", signal: AbortSignal.timeout(750) });
      await sleep(1000);
    } catch {
      return;
    }
  }
  throw new Error(`Port ${port} is still in use`);
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
    await sleep(1000);
  }
  throw new Error(`Server did not become ready at ${url}`);
}

function buildServerEnv(mode: RolloutEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_PUBLIC_SITE_URL: BASE_URL,
  };
  delete env.MASTER_SEO_ROLLOUT_MODE;
  if (mode === "CANARY") {
    env.MASTER_SEO_ROLLOUT_MODE = "CANARY";
  } else if (mode === "OFF") {
    env.MASTER_SEO_ROLLOUT_MODE = "OFF";
  }
  return env;
}

async function assertServerRolloutMode(baseUrl: string, expectRedirects: boolean): Promise<void> {
  const probe = await probeUrl(baseUrl, "/emoji/keycap", { followRedirects: false });
  const redirecting = probe.status === 301;
  if (redirecting !== expectRedirects) {
    throw new Error(
      `Server rollout mismatch at ${baseUrl}: expected redirects=${expectRedirects}, got status=${probe.status}`,
    );
  }
}

async function startServer(mode: RolloutEnv): Promise<ChildProcess> {
  killPortListeners(PORT);
  await waitForPortFree(PORT);
  const child = spawn("npm", ["run", "start", "--", "-p", PORT], {
    cwd: rootDir,
    shell: true,
    stdio: "ignore",
    env: buildServerEnv(mode),
  });
  await waitForServer(BASE_URL);
  await assertServerRolloutMode(BASE_URL, mode === "CANARY");
  return child;
}

function stopServer(child: ChildProcess | null): void {
  killProcessTree(child);
}

async function main(): Promise<void> {
  let server: ChildProcess | null = null;
  const useExternalBaseUrl = Boolean(process.env.SEO_QA_BASE_URL);

  try {
    if (!useExternalBaseUrl) {
      console.log("Phase 8.12F — Step 1: OFF baseline (no MASTER_SEO_ROLLOUT_MODE)...");
      server = await startServer("unset");
    }
    const offAudit = await buildOffBehaviorHttpAudit(BASE_URL, rootDir);
    console.log(`OFF baseline audit: ${offAudit.status}`);

    if (!useExternalBaseUrl) {
      stopServer(server);
      server = null;
      await sleep(2000);
      console.log("Phase 8.12F — Step 2: CANARY deployment (MASTER_SEO_ROLLOUT_MODE=CANARY)...");
      server = await startServer("CANARY");
    }
    const canaryHttp = await buildCanaryHttpAuditPackage(BASE_URL, rootDir);
    console.log(`CANARY HTTP audit: ${canaryHttp.status}`);

    if (!useExternalBaseUrl) {
      stopServer(server);
      server = null;
      await sleep(2000);
      console.log("Phase 8.12F — Step 3: Rollback (MASTER_SEO_ROLLOUT_MODE=OFF)...");
      server = await startServer("OFF");
    }
    const rollbackAudit = await buildRollbackHttpAudit(BASE_URL);
    console.log(`Rollback audit: ${rollbackAudit.status}`);

    if (!useExternalBaseUrl) {
      stopServer(server);
      server = null;
      await sleep(2000);
      console.log("Phase 8.12F — Step 4: Default OFF (env var removed)...");
      server = await startServer("unset");
    }
    const defaultOffAudit = await buildOffBehaviorHttpAudit(BASE_URL, rootDir);
    console.log(`Default OFF audit: ${defaultOffAudit.status}`);

    const productionPackage = await buildCanaryProductionPackage({
      baseUrl: BASE_URL,
      rootDir,
      environment: CANARY_ENVIRONMENT,
      offAudit,
      defaultOffAudit,
      canaryHttp,
      rollbackAudit,
    });

    writeJson(join(productionDir, "canary-deployment-audit.json"), productionPackage.deploymentAudit);
    writeJson(join(productionDir, "http-redirect-audit.json"), productionPackage.httpRedirectAudit);
    writeJson(join(productionDir, "preserved-url-audit.json"), productionPackage.preservedUrlAudit);
    writeJson(join(productionDir, "excluded-url-audit.json"), productionPackage.excludedUrlAudit);
    writeJson(join(productionDir, "canonical-audit.json"), productionPackage.canonicalAudit);
    writeJson(join(productionDir, "sitemap-audit.json"), productionPackage.sitemapAudit);
    writeJson(join(productionDir, "emoji-matrix-audit.json"), productionPackage.emojiMatrixAudit);
    writeJson(join(productionDir, "security-audit.json"), productionPackage.securityAudit);
    writeJson(join(productionDir, "performance-audit.json"), productionPackage.performanceAudit);
    writeJson(join(productionDir, "rollback-audit.json"), productionPackage.rollbackAudit);
    writeJson(join(productionDir, "production-safety-audit.json"), productionPackage.productionSafetyAudit);
    writeJson(join(productionDir, "final-canary-manifest.json"), productionPackage.finalCanaryManifest);

    console.log(`Decision: ${productionPackage.decision}`);
    if (productionPackage.decision.startsWith("C")) {
      process.exitCode = 1;
    }
  } finally {
    stopServer(server);
    killPortListeners(PORT);
    delete process.env.MASTER_SEO_ROLLOUT_MODE;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
