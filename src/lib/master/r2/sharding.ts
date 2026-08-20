import { createHash } from "node:crypto";

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256FileHex(filePath: string, readFile: (path: string) => Buffer): string {
  return sha256Hex(readFile(filePath));
}

export function shardIdForIndex(index: number, width = 2): string {
  return `shard-${String(index).padStart(width, "0")}`;
}

export function shardRecords<T>(records: readonly T[], shardSize: number): T[][] {
  const shards: T[][] = [];
  for (let index = 0; index < records.length; index += shardSize) {
    shards.push(records.slice(index, index + shardSize));
  }
  return shards;
}

export function stableSortBy<T>(records: readonly T[], selector: (record: T) => string): T[] {
  return [...records].sort((left, right) => selector(left).localeCompare(selector(right)));
}
