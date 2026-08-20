import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Agent, setGlobalDispatcher } from "undici";
import { R2_BUCKET_NAME } from "./wrangler-r2";

export const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? "2d3758e59ffd918df1dfb1c525510ada";
const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}`;

let tokenCache: string | null = null;
let agentInstalled = false;

export function clearWranglerTokenCache(): void {
  tokenCache = null;
}

export interface R2HttpResult {
  readonly ok: boolean;
  readonly status: number;
  readonly body: string;
  readonly retryAfterSec: number;
}

export interface HeadObjectResult {
  readonly ok: boolean;
  readonly status: number;
  readonly contentLength: number | null;
  readonly contentType: string | null;
  readonly etag: string | null;
  readonly body: string;
  readonly retryAfterSec: number;
}

function ensureAgent(): void {
  if (agentInstalled) return;
  const maxConn = Number(process.env.R2_HTTP_MAX_CONNECTIONS ?? "128");
  setGlobalDispatcher(new Agent({ connections: maxConn, pipelining: 1, keepAliveTimeout: 60_000 }));
  agentInstalled = true;
}

export function readWranglerOAuthToken(): string {
  if (process.env.CLOUDFLARE_API_TOKEN?.trim()) return process.env.CLOUDFLARE_API_TOKEN.trim();
  if (tokenCache) return tokenCache;
  const candidates = [
    join(process.env.APPDATA ?? "", "xdg.config", ".wrangler", "config", "default.toml"),
    join(process.env.HOME ?? "", ".wrangler", "config", "default.toml"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    const match = /oauth_token\s*=\s*"([^"]+)"/.exec(text);
    if (match?.[1]) {
      tokenCache = match[1];
      return tokenCache;
    }
  }
  throw new Error("No Cloudflare OAuth token found (wrangler login required)");
}

function parseRetryAfterSec(status: number, body: string, headers: Headers): number {
  if (status !== 429) return 0;
  const header = headers.get("retry-after");
  if (header && /^\d+$/.test(header)) return Number(header) + 1;
  const match = /wait (\d+) second/i.exec(body);
  return match ? Number(match[1]) + 2 : 45;
}

function isRetryable(status: number, body: string): boolean {
  if (status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  const lower = body.toLowerCase();
  return lower.includes("econnreset") || lower.includes("timeout") || lower.includes("temporarily unavailable");
}

export async function putObjectHttp(objectKey: string, body: Buffer, contentType: string): Promise<R2HttpResult> {
  ensureAgent();
  const token = readWranglerOAuthToken();
  const url = `${API_BASE}/objects/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  const timeoutMs = Number(process.env.R2_HTTP_TIMEOUT_MS ?? "90000");
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body: text,
      retryAfterSec: parseRetryAfterSec(res.status, text, res.headers),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut = message.toLowerCase().includes("timeout") || message.toLowerCase().includes("aborted");
    return {
      ok: false,
      status: timedOut ? 408 : 0,
      body: message,
      retryAfterSec: 0,
    };
  }
}

export async function headObjectHttp(objectKey: string): Promise<HeadObjectResult> {
  ensureAgent();
  const timeoutMs = Number(process.env.R2_HTTP_TIMEOUT_MS ?? "90000");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = readWranglerOAuthToken();
    const url = `${API_BASE}/objects/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 401 && attempt < 3) {
        clearWranglerTokenCache();
        continue;
      }
      const text = await res.text();
      const lengthHeader = res.headers.get("content-length");
      return {
        ok: res.ok,
        status: res.status,
        contentLength: lengthHeader && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : null,
        contentType: res.headers.get("content-type"),
        etag: res.headers.get("etag"),
        body: text,
        retryAfterSec: parseRetryAfterSec(res.status, text, res.headers),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const timedOut = message.toLowerCase().includes("timeout") || message.toLowerCase().includes("aborted");
      if (attempt >= 3) {
        return {
          ok: false,
          status: timedOut ? 408 : 0,
          contentLength: null,
          contentType: null,
          etag: null,
          body: message,
          retryAfterSec: 0,
        };
      }
    }
  }
  return {
    ok: false,
    status: 0,
    contentLength: null,
    contentType: null,
    etag: null,
    body: "head failed",
    retryAfterSec: 0,
  };
}

export async function getObjectHttp(objectKey: string): Promise<Buffer | null> {
  ensureAgent();
  const timeoutMs = Number(process.env.R2_HTTP_TIMEOUT_MS ?? "90000");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = readWranglerOAuthToken();
    const url = `${API_BASE}/objects/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 401 && attempt < 3) {
        clearWranglerTokenCache();
        continue;
      }
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      if (attempt >= 3) return null;
    }
  }
  return null;
}

export async function putObjectWithRetry(
  objectKey: string,
  body: Buffer,
  contentType: string,
  maxAttempts = 8,
): Promise<R2HttpResult> {
  let last: R2HttpResult = { ok: false, status: 0, body: "", retryAfterSec: 0 };
  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    last = await putObjectHttp(objectKey, body, contentType);
    if (last.ok) return last;
    if (!isRetryable(last.status, last.body) || attempt >= maxAttempts) return last;
    const base = last.retryAfterSec > 0 ? last.retryAfterSec * 1000 : 500 * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 250);
    await new Promise((r) => setTimeout(r, base + jitter));
  }
  return last;
}