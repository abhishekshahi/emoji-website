import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { MasterSourceLockEntry } from "./types";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
export const rootDir = join(scriptsDir, "..", "..", "..");
export const masterDir = join(rootDir, "src", "data", "master");
export const rawDir = join(masterDir, "raw");
export const vendorDir = join(rawDir, "vendor");
export const artworkDir = join(rawDir, "artwork");

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function resolveArchiveUrl(entry: MasterSourceLockEntry): string {
  if (entry.downloadURL?.endsWith(".zip")) {
    return entry.downloadURL;
  }

  if (entry.commit && entry.repositoryURL.includes("github.com")) {
    const repo = entry.repositoryURL.replace(/\/$/, "");
    return `${repo}/archive/${entry.commit}.zip`;
  }

  if (entry.downloadURL) {
    return entry.downloadURL;
  }

  throw new Error(`No archive URL available for source: ${entry.source}`);
}

export function getLockEntry(
  lock: { sources: MasterSourceLockEntry[] },
  sourceId: string,
): MasterSourceLockEntry {
  const entry = lock.sources.find((source) => source.source === sourceId);
  if (!entry) {
    throw new Error(`Missing lock entry for source: ${sourceId}`);
  }
  return entry;
}

export function copyTreeFiles(
  sourceRoot: string,
  destinationRoot: string,
  filter: (filePath: string) => boolean,
): string[] {
  const copied: string[] = [];

  function walk(current: string): void {
    if (!existsSync(current)) {
      return;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const sourcePath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(sourcePath);
        continue;
      }

      if (!filter(sourcePath)) {
        continue;
      }

      const relativePath = relative(sourceRoot, sourcePath);
      const destinationPath = join(destinationRoot, relativePath);
      ensureDir(dirname(destinationPath));
      copyFileSync(sourcePath, destinationPath);
      copied.push(destinationPath);
    }
  }

  walk(sourceRoot);
  return copied;
}

export async function downloadKaggleDataset(
  apiUrl: string,
  destinationPath: string,
  expectedChecksum?: string | null,
): Promise<void> {
  ensureDir(dirname(destinationPath));
  if (existsSync(destinationPath) && expectedChecksum) {
    if (sha256File(destinationPath) === expectedChecksum) {
      return;
    }
    unlinkSync(destinationPath);
  } else if (existsSync(destinationPath) && statSync(destinationPath).size > 0) {
    return;
  }

  const redirect = await fetch(apiUrl, {
    redirect: "manual",
    headers: { "User-Agent": "Mozilla/5.0 EmojiFind-Phase-8.2" },
  });
  const location = redirect.headers.get("location");
  if (!location) {
    throw new Error(`Missing Kaggle download redirect for ${apiUrl}: HTTP ${redirect.status}`);
  }

  const response = await fetch(location);
  if (!response.ok) {
    throw new Error(`Failed to download Kaggle bundle: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destinationPath, buffer);

  if (expectedChecksum && sha256File(destinationPath) !== expectedChecksum) {
    throw new Error(
      `EmojiNet bundle checksum mismatch. Expected ${expectedChecksum}, got ${sha256File(destinationPath)}`,
    );
  }
}

export function parseEmojinetUnicode(unicodeField: string): {
  codepoints: string[];
  sequence: string;
  emoji: string | null;
} {
  const codepoints = unicodeField
    .split(/\s+/)
    .map((part) => part.replace(/^U\+/i, "").toUpperCase())
    .filter(Boolean);
  const sequence = codepoints.join("-");

  try {
    return {
      codepoints,
      sequence,
      emoji: String.fromCodePoint(...codepoints.map((part) => Number.parseInt(part, 16))),
    };
  } catch {
    return { codepoints, sequence, emoji: null };
  }
}

export async function downloadFile(url: string, destinationPath: string): Promise<void> {
  ensureDir(dirname(destinationPath));
  if (existsSync(destinationPath) && statSync(destinationPath).size > 0) {
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destinationPath, buffer);
}

export function isValidZip(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }

  const size = statSync(path).size;
  if (size < 4) {
    return false;
  }

  const fd = openSync(path, "r");
  try {
    const head = Buffer.alloc(4);
    readSync(fd, head, 0, 4, 0);
    if (head[0] !== 0x50 || head[1] !== 0x4b) {
      return false;
    }

    const scanSize = Math.min(size, 65536);
    const tail = Buffer.alloc(scanSize);
    readSync(fd, tail, 0, scanSize, size - scanSize);
    for (let index = tail.length - 4; index >= 0; index -= 1) {
      if (
        tail[index] === 0x50 &&
        tail[index + 1] === 0x4b &&
        tail[index + 2] === 0x05 &&
        tail[index + 3] === 0x06
      ) {
        return true;
      }
    }

    return false;
  } finally {
    closeSync(fd);
  }
}

export function extractZip(zipPath: string, destinationDir: string): string {
  ensureDir(destinationDir);
  const existingRoot = findSingleChildDir(destinationDir);
  if (existingRoot !== destinationDir && readdirSync(existingRoot).length > 0) {
    return existingRoot;
  }

  if (!isValidZip(zipPath)) {
    unlinkSync(zipPath);
    throw new Error(`Invalid or incomplete zip archive: ${zipPath}`);
  }

  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" },
  );
  return findSingleChildDir(destinationDir);
}

export function npmPackExtract(
  packageSpec: string,
  destinationDir: string,
): string {
  ensureDir(destinationDir);
  const packOutput = execSync(`npm pack ${packageSpec} --silent`, {
    cwd: destinationDir,
    encoding: "utf8",
  }).trim();
  const tgzName = packOutput.split("\n").pop() ?? packOutput;
  const tgzPath = join(destinationDir, tgzName);
  const extractDir = join(destinationDir, basename(tgzName, ".tgz"));
  ensureDir(extractDir);
  execSync(`tar -xzf "${tgzPath}" -C "${extractDir}"`, { stdio: "inherit" });
  return join(extractDir, "package");
}

export function toCodepointsFromHexcode(hexcode: string): string[] {
  return hexcode.split("-").filter(Boolean);
}

export function hexcodeToEmoji(hexcode: string): string | null {
  try {
    return String.fromCodePoint(
      ...toCodepointsFromHexcode(hexcode).map((part) => Number.parseInt(part, 16)),
    );
  } catch {
    return null;
  }
}

export function relativeToRaw(path: string): string {
  return relative(rawDir, path).replace(/\\/g, "/");
}

export function isPrivateUseHexcode(hexcode: string): boolean {
  return toCodepointsFromHexcode(hexcode).some((part) => {
    const value = Number.parseInt(part, 16);
    return value >= 0xe000 && value <= 0xf8ff;
  });
}

export function parseUnicodeDataLines(content: string): Array<{
  codePoints: string[];
  hexcode: string;
  field: string;
  value: string;
}> {
  const records: Array<{
    codePoints: string[];
    hexcode: string;
    field: string;
    value: string;
  }> = [];

  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) {
      continue;
    }

    const [left, right] = line.split(";");
    if (!left || !right) {
      continue;
    }

    const codePoints = left
      .trim()
      .split(/\s+/)
      .map((part) => part.toUpperCase());
    const [field, value] = right.trim().split(/\s+/, 2);

    records.push({
      codePoints,
      hexcode: codePoints.join("-"),
      field: field ?? "",
      value: value ?? "",
    });
  }

  return records;
}

export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export function findSingleChildDir(parentDir: string): string {
  const children = readdirSync(parentDir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  if (children.length === 1) {
    return join(parentDir, children[0].name);
  }
  return parentDir;
}

export function parseEmojiTestLines(content: string): Array<{
  codePoints: string[];
  hexcode: string;
  status: string;
  comment: string;
}> {
  const records: Array<{
    codePoints: string[];
    hexcode: string;
    status: string;
    comment: string;
  }> = [];

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(
      /^([0-9A-F]+(?:\s+[0-9A-F]+)*)\s*;\s*([^#]+)#\s*(.+)$/i,
    );
    if (!match) {
      continue;
    }

    const codePoints = match[1]
      .trim()
      .split(/\s+/)
      .map((part) => part.toUpperCase());
    records.push({
      codePoints,
      hexcode: codePoints.join("-"),
      status: match[2].trim(),
      comment: match[3].trim(),
    });
  }

  return records;
}
