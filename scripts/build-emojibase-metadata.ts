import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EmojiRecord } from "../src/lib/emoji/types";
import { buildEmojibaseSearchMetadata } from "./emoji/emojibase-metadata";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const emojisPath = join(rootDir, "src", "data", "emojis.json");
const outputPath = join(rootDir, "src", "data", "emojibase-metadata.json");

function main(): void {
  const emojis = JSON.parse(readFileSync(emojisPath, "utf8")) as EmojiRecord[];
  const metadata = buildEmojibaseSearchMetadata(emojis.map((emoji) => emoji.hexcode));

  writeFileSync(outputPath, `${JSON.stringify(metadata)}\n`, "utf8");

  console.log(`Emojibase version: ${metadata.emojibaseVersion}`);
  console.log(`Standard records: ${metadata.stats.totalStandard}`);
  console.log(`Matched: ${metadata.stats.matched}`);
  console.log(`Unmatched: ${metadata.stats.unmatched}`);
  console.log(`Output: ${outputPath}`);
}

main();
