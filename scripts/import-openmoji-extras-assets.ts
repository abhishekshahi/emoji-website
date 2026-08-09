import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const extras = JSON.parse(
  readFileSync(join(rootDir, "src/data/openmoji-extras.json"), "utf8"),
) as Array<{ hexcode: string }>;

const openmojiPackageDir = join(rootDir, "node_modules/openmoji");
const openmojiSvgDir = join(openmojiPackageDir, "color", "svg");
const outputDir = join(rootDir, "public", "openmoji-extras");
const manifestPath = join(rootDir, "src/data/openmoji-extras-artwork-manifest.json");

const openmojiPackage = JSON.parse(
  readFileSync(join(openmojiPackageDir, "package.json"), "utf8"),
) as { version: string };

const VARIATION_SELECTORS = new Set(["FE0F", "FE0E"]);

function resolveSourceHexcode(hexcode: string): string | null {
  const candidates = [hexcode];

  const stripped = hexcode
    .split("-")
    .filter((part) => !VARIATION_SELECTORS.has(part))
    .join("-");

  if (stripped !== hexcode) {
    candidates.push(stripped);
  }

  for (const candidate of candidates) {
    const sourcePath = join(openmojiSvgDir, `${candidate}.svg`);
    if (existsSync(sourcePath)) {
      return candidate;
    }
  }

  return null;
}

function main(): void {
  if (!existsSync(openmojiSvgDir)) {
    throw new Error(
      "OpenMoji SVG directory not found. Run npm install openmoji first.",
    );
  }

  mkdirSync(outputDir, { recursive: true });

  const artwork: Record<
    string,
    {
      path: string;
      sourceHexcode: string;
    }
  > = {};

  let imported = 0;
  let missing = 0;

  for (const extra of extras) {
    const sourceHexcode = resolveSourceHexcode(extra.hexcode);

    if (!sourceHexcode) {
      missing += 1;
      continue;
    }

    const destinationFileName = `${extra.hexcode}.svg`;
    const destinationPath = join(outputDir, destinationFileName);
    const sourcePath = join(openmojiSvgDir, `${sourceHexcode}.svg`);

    copyFileSync(sourcePath, destinationPath);
    artwork[extra.hexcode] = {
      path: `/openmoji-extras/${destinationFileName}`,
      sourceHexcode,
    };
    imported += 1;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    openmojiVersion: openmojiPackage.version,
    format: "svg",
    imported,
    missing,
    totalExtras: extras.length,
    artwork,
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`OpenMoji Extras ${openmojiPackage.version}`);
  console.log(`Imported ${imported} SVG assets to public/openmoji-extras/`);
  console.log(`Missing artwork: ${missing}`);
  console.log(`Manifest: ${manifestPath}`);
}

main();
