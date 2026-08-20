import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256Buffer(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256File(path: string): { sha256: string; bytes: number } {
  const buf = readFileSync(path);
  return { sha256: sha256Buffer(buf), bytes: buf.length };
}

export function verifyChecksum(path: string, expected: string): boolean {
  return sha256File(path).sha256 === expected.toLowerCase();
}
