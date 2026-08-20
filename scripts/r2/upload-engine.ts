import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { extname } from "node:path";
import {
  bucketExists,
  isR2AccountEnabled,
  R2_BUCKET_NAME,
  remoteObjectExists,
  uploadObject,
} from "./wrangler-r2";

export interface UploadDirectoryOptions {
  readonly projectRoot: string;
  readonly exportRootDir: string;
  readonly r2KeyPrefix: string;
  readonly dryRun?: boolean;
  readonly maxFiles?: number;
  readonly skipExisting?: boolean;
}

export interface UploadDirectoryResult {
  readonly uploaded: number;
  readonly skipped: number;
  readonly failed: number;
  readonly total: number;
}

function guessContentType(filePath: string): string | undefined {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".json":
      return "application/json";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    default:
      return undefined;
  }
}

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

export function collectUploadFiles(exportRootDir: string): string[] {
  if (!existsSync(exportRootDir)) {
    throw new Error(`Export directory not found: ${exportRootDir}`);
  }
  return walkFiles(exportRootDir).sort();
}

export function buildObjectPath(r2KeyPrefix: string, exportRootDir: string, absoluteFile: string): string {
  const relativePath = relative(exportRootDir, absoluteFile).replace(/\\/g, "/");
  return `${R2_BUCKET_NAME}/${r2KeyPrefix}/${relativePath}`;
}

export async function requireUploadConfirmation(prompt: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  const answer = await rl.question(prompt);
  rl.close();
  return answer.trim().toUpperCase() === "YES";
}

export function assertUploadPreconditions(projectRoot: string): void {
  const account = isR2AccountEnabled(projectRoot);
  if (!account.enabled) {
    throw new Error(account.message);
  }
  if (!bucketExists(projectRoot, R2_BUCKET_NAME)) {
    throw new Error(`Bucket ${R2_BUCKET_NAME} does not exist. Create it with: npx wrangler r2 bucket create ${R2_BUCKET_NAME}`);
  }
}

export async function uploadDirectory(options: UploadDirectoryOptions): Promise<UploadDirectoryResult> {
  const files = collectUploadFiles(options.exportRootDir);
  const limit = options.maxFiles ?? files.length;
  const selected = files.slice(0, limit);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, filePath] of selected.entries()) {
    const objectPath = buildObjectPath(options.r2KeyPrefix, options.exportRootDir, filePath);
    const contentType = guessContentType(filePath);

    if (options.dryRun) {
      continue;
    }

    if (options.skipExisting && remoteObjectExists(options.projectRoot, objectPath)) {
      skipped += 1;
      continue;
    }

    const result = uploadObject(options.projectRoot, objectPath, filePath, contentType);
    if (result.ok) {
      uploaded += 1;
    } else {
      failed += 1;
      console.error(`FAILED ${objectPath}: ${result.stderr.trim() || result.stdout.trim()}`);
      if (failed >= 5) {
        throw new Error("Too many upload failures. Stopping.");
      }
    }

    if ((index + 1) % 250 === 0 || index + 1 === selected.length) {
      console.log(`Progress: ${index + 1}/${selected.length} (uploaded=${uploaded}, skipped=${skipped}, failed=${failed})`);
    }
  }

  return { uploaded, skipped, failed, total: selected.length };
}