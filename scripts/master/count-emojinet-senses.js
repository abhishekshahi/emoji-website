import { readFileSync } from "node:fs";
import { join } from "node:path";

const jsonPath = join(
  "src",
  "data",
  "master",
  "raw",
  "vendor",
  "emojinet",
  "kaggle-v1-extracted",
  "emojis.json",
);

const data = JSON.parse(readFileSync(jsonPath, "utf8"));

let babelNetSenseIds = 0;
let senseLabelStrings = 0;
let unicodeMappings = 0;

for (const record of data) {
  if (record.unicode) {
    unicodeMappings += 1;
  }

  const senses = record.senses;
  if (!senses || typeof senses !== "object") {
    continue;
  }

  for (const partOfSpeech of Object.values(senses)) {
    if (!Array.isArray(partOfSpeech)) {
      continue;
    }

    for (const senseGroup of partOfSpeech) {
      if (!senseGroup || typeof senseGroup !== "object") {
        continue;
      }

      for (const labels of Object.values(senseGroup)) {
        babelNetSenseIds += 1;
        if (Array.isArray(labels)) {
          senseLabelStrings += labels.length;
        }
      }
    }
  }
}

console.log(
  JSON.stringify(
    {
      emojiRecords: data.length,
      unicodeMappings,
      babelNetSenseIds,
      senseLabelStrings,
      semanticFields: [
        "category",
        "keywords",
        "definition",
        "unicode",
        "name",
        "shortcode",
        "senses.{partOfSpeech}[].{babelNetId}[]",
      ],
    },
    null,
    2,
  ),
);
