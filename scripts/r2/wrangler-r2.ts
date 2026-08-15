import { execSync, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const R2_BUCKET_NAME = "emojiquick-master" as const;

function resolveWranglerCommand(cwd: string): { command: string; args: string[]; shell: boolean } {
  const wranglerJs = join(cwd, "node_modules", "wrangler", "bin", "wrangler.js");
  if (existsSync(wranglerJs)) {
    return { command: process.execPath, args: [wranglerJs], shell: false };
  }
  const local = join(cwd, "node_modules", ".bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");
  if (existsSync(local)) {
    return { command: local, args: [], shell: process.platform === "win32" };
  }
  return { command: "wrangler", args: [], shell: true };
}

export interface WranglerResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export function runWrangler(args: readonly string[], cwd: string): WranglerResult {
  const wrangler = resolveWranglerCommand(cwd);
  const result = spawnSync(wrangler.command, [...wrangler.args, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: wrangler.shell,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

const DEFAULT_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWranglerAsync(
  args: readonly string[],
  cwd: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WranglerResult> {
  const wrangler = resolveWranglerCommand(cwd);
  return await new Promise((resolve) => {
    const child = spawn(wrangler.command, [...wrangler.args, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: wrangler.shell,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve({
        ok: false,
        stdout,
        stderr: `${stderr}\nwrangler timed out after ${timeoutMs}ms`,
        exitCode: 1,
      });
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });
    child.on("error", (error) => {
      resolve({
        ok: false,
        stdout,
        stderr: `${stderr}\n${error.message}`,
        exitCode: 1,
      });
    });
  });
}

export async function uploadObjectWithRetryAsync(
  cwd: string,
  objectPath: string,
  filePath: string,
  contentType?: string,
  maxAttempts = 8,
): Promise<WranglerResult> {
  let last: WranglerResult = { ok: false, stdout: "", stderr: "", exitCode: 1 };
  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    last = await uploadObjectAsync(cwd, objectPath, filePath, contentType);
    if (last.ok) return last;
    const output = `${last.stdout}\n${last.stderr}`;
    if (!isRateLimitedOutput(output) || attempt >= maxAttempts) return last;
    await sleep(parseRetryAfterSeconds(output) * 1000);
  }
  return last;
}

export async function uploadObjectAsync(
  cwd: string,
  objectPath: string,
  filePath: string,
  contentType?: string,
): Promise<WranglerResult> {
  const args = ["r2", "object", "put", objectPath, "--file", filePath, "--remote"];
  if (contentType) {
    args.push("--content-type", contentType);
  }
  return runWranglerAsync(args, cwd);
}

function isRateLimitedOutput(output: string): boolean {
  const lower = output.toLowerCase();
  return lower.includes("429") || lower.includes("too many requests") || lower.includes("[code: 971]");
}

function parseRetryAfterSeconds(output: string): number {
  const match = /wait (\d+) second/.exec(output);
  return match ? Number(match[1]) + 2 : 45;
}

function sleepSync(ms: number): void {
  if (ms <= 0) return;
  if (process.platform === "win32") {
    execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { stdio: "ignore" });
    return;
  }
  execSync(`sleep ${Math.ceil(ms / 1000)}`, { stdio: "ignore" });
}

export function runWranglerWithRetry(args: readonly string[], cwd: string, maxAttempts = 5): WranglerResult {
  let last = runWrangler(args, cwd);
  for (let attempt = 1; attempt < maxAttempts && !last.ok; attempt += 1) {
    const output = `${last.stdout}\n${last.stderr}`;
    if (!isRateLimitedOutput(output)) break;
    sleepSync(parseRetryAfterSeconds(output) * 1000);
    last = runWrangler(args, cwd);
  }
  return last;
}

export function isR2AccountEnabled(cwd: string): { enabled: boolean; message: string } {
  const result = runWranglerWithRetry(["r2", "bucket", "list"], cwd);
  const output = `${result.stdout}\n${result.stderr}`;
  if (!result.ok) {
    if (output.includes("10042") || output.toLowerCase().includes("enable r2")) {
      return {
        enabled: false,
        message: "Cloudflare R2 is not enabled on this account (error 10042).",
      };
    }
    return { enabled: false, message: `R2 account check failed: ${output.trim()}` };
  }
  return { enabled: true, message: "R2 account is enabled." };
}

export function bucketExists(cwd: string, bucketName: string): boolean {
  const result = runWranglerWithRetry(["r2", "bucket", "list"], cwd);
  return result.ok && result.stdout.includes(bucketName);
}

export function remoteObjectExists(cwd: string, objectPath: string): boolean {
  const result = runWrangler(["r2", "object", "get", objectPath, "--pipe", "--remote"], cwd);
  return result.ok;
}

export function uploadObject(
  cwd: string,
  objectPath: string,
  filePath: string,
  contentType?: string,
): WranglerResult {
  const args = ["r2", "object", "put", objectPath, "--file", filePath, "--remote"];
  if (contentType) {
    args.push("--content-type", contentType);
  }
  return runWrangler(args, cwd);
}

export function downloadObjectToBuffer(cwd: string, objectPath: string): Buffer | null {
  const result = runWrangler(["r2", "object", "get", objectPath, "--pipe", "--remote"], cwd);
  if (!result.ok) {
    return null;
  }
  return Buffer.from(result.stdout, "binary");
}