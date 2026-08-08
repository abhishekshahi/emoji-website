import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEmojiDataset } from "./emoji/build-dataset";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const unicodeSourceDir = join(rootDir, "data", "unicode-source");
const outputDir = join(rootDir, "src", "data");

function readUnicodeFile(fileName: string): string {
  return readFileSync(join(unicodeSourceDir, fileName), "utf8");
}

function main(): void {
  const dataset = buildEmojiDataset({
    emojiTestContent: readUnicodeFile("emoji-test.txt"),
    emojiSequencesContent: readUnicodeFile("emoji-sequences.txt"),
    emojiZwjSequencesContent: readUnicodeFile("emoji-zwj-sequences.txt"),
  });

  mkdirSync(outputDir, { recursive: true });

  writeFileSync(
    join(outputDir, "emojis.json"),
    `${JSON.stringify(dataset.emojis)}\n`,
    "utf8",
  );

  writeFileSync(
    join(outputDir, "manifest.json"),
    `${JSON.stringify(dataset.manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`Generated ${dataset.manifest.recordCount} emoji records.`);
  console.log(`Emoji version: ${dataset.manifest.emojiVersion}`);
  console.log(`Categories: ${dataset.manifest.categoryCount}`);
  console.log(
    `Keywords coverage: ${dataset.manifest.stats.withKeywords}/${dataset.manifest.recordCount}`,
  );
  console.log(
    `Shortcode coverage: ${dataset.manifest.stats.withShortcodes}/${dataset.manifest.recordCount}`,
  );
  console.log(`Output: ${outputDir}`);
}

main();
