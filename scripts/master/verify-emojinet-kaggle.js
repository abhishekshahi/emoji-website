import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const vendorDir = join(rootDir, "src", "data", "master", "raw", "vendor", "emojinet");
const zipPath = join(vendorDir, "kaggle-emojinet-v1.zip");
const extractDir = join(vendorDir, "kaggle-v1-extracted");

async function downloadKaggleBundle() {
  const redirect = await fetch(
    "https://www.kaggle.com/api/v1/datasets/download/rtatman/emojinet?datasetVersionNumber=1",
    { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 EmojiFind-Phase-8.1B" } },
  );
  const location = redirect.headers.get("location");
  if (!location) {
    throw new Error(`Missing Kaggle download redirect: HTTP ${redirect.status}`);
  }

  mkdirSync(vendorDir, { recursive: true });
  const response = await fetch(location);
  if (!response.ok) {
    throw new Error(`Failed to download Kaggle bundle: HTTP ${response.status}`);
  }

  await pipeline(response.body, createWriteStream(zipPath));
}

function extractZip() {
  mkdirSync(extractDir, { recursive: true });
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" },
  );
}

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function analyzeJson(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(data)) {
    const emojiCount = data.length;
    let senseCount = 0;
    let unicodeMappings = 0;
    for (const record of data) {
      if (record.unicode || record.emoji || record.code) {
        unicodeMappings += 1;
      }
      const senses = record.senses ?? record.sense ?? record.definitions ?? [];
      if (Array.isArray(senses)) {
        senseCount += senses.length;
      } else if (typeof senses === "object" && senses !== null) {
        senseCount += Object.keys(senses).length;
      }
    }
    return { emojiCount, senseCount, unicodeMappings, topLevel: "array" };
  }

  if (typeof data === "object" && data !== null) {
    const keys = Object.keys(data);
    let senseCount = 0;
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) {
        senseCount += value.length;
      } else if (typeof value === "object" && value !== null) {
        const senses = value.senses ?? value.sense ?? value.definitions ?? [];
        if (Array.isArray(senses)) {
          senseCount += senses.length;
        }
      }
    }
    return {
      emojiCount: keys.length,
      senseCount,
      unicodeMappings: keys.length,
      topLevel: "object",
    };
  }

  return { emojiCount: 0, senseCount: 0, unicodeMappings: 0, topLevel: "unknown" };
}

async function main() {
  if (!existsSync(zipPath)) {
    await downloadKaggleBundle();
  }

  const zipChecksum = sha256File(zipPath);
  const zipBytes = statSync(zipPath).size;
  console.log("zipPath", zipPath);
  console.log("zipBytes", zipBytes);
  console.log("zipChecksum", zipChecksum);

  extractZip();
  const files = walkFiles(extractDir);
  console.log(
    "files",
    files.map((file) => file.replace(extractDir, "").replace(/\\/g, "/")),
  );

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const stats = analyzeJson(file);
    console.log("json", file.replace(extractDir, ""), stats);
    console.log("jsonChecksum", sha256File(file));
  }
}

void main();
