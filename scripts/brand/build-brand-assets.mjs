/**
 * EmojiQuick brand asset builder — official source → UI, favicon, OG derivatives.
 */
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(root, "public/brand/emojiquick-logo-official-source.png");
const OUT = join(root, "public/brand");
const APP = join(root, "src/app");
const OG_BG = { r: 247, g: 244, b: 239 }; // matches --background light

if (!existsSync(SOURCE)) {
  console.error("Missing official logo source:", SOURCE);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

/** Remove baked-in cream background so the logo blends with the site. */
async function buildTransparentUiLogo(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (r >= 235 && g >= 233 && b >= 228 && spread < 28) {
      data[i + 3] = 0;
    }
  }

  const transparent = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 1 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const meta = await sharp(transparent).metadata();
  return { buffer: transparent, width: meta.width ?? 0, height: meta.height ?? 0 };
}

const sourceMeta = await sharp(SOURCE).metadata();
console.log("Source:", `${sourceMeta.width}x${sourceMeta.height}`);

await sharp(SOURCE).png({ compressionLevel: 9 }).toFile(join(OUT, "emojiquick-logo-primary.png"));

const ui = await buildTransparentUiLogo(SOURCE);
await sharp(ui.buffer).toFile(join(OUT, "emojiquick-logo-ui.png"));
await sharp(ui.buffer).webp({ quality: 92, alphaQuality: 100 }).toFile(join(OUT, "emojiquick-logo-ui.webp"));

console.log("UI logo (transparent, trimmed):", `${ui.width}x${ui.height}`);

/** Mascot-only square for favicons — contain, never crop. */
const mascotRegion = await sharp(SOURCE)
  .extract({
    left: Math.round((sourceMeta.width ?? 1024) * 0.08),
    top: Math.round((sourceMeta.height ?? 558) * 0.02),
    width: Math.round((sourceMeta.width ?? 1024) * 0.84),
    height: Math.round((sourceMeta.height ?? 558) * 0.58),
  })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp(mascotRegion).toFile(join(OUT, "emojiquick-icon.png"));

for (const size of [16, 32, 48, 96, 180, 192, 256, 512]) {
  await sharp(mascotRegion)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, `favicon-${size}.png`));
}

const ogLogo = await sharp(ui.buffer).resize(920).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: OG_BG } })
  .composite([{ input: ogLogo, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, "emojiquick-og.png"));

const og4kLogo = await sharp(ui.buffer).resize(2400).png().toBuffer();
await sharp({ create: { width: 3840, height: 2160, channels: 3, background: OG_BG } })
  .composite([{ input: og4kLogo, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, "emojiquick-logo-primary-4k.png"));

copyFileSync(join(OUT, "favicon-32.png"), join(APP, "icon.png"));
copyFileSync(join(OUT, "favicon-180.png"), join(APP, "apple-icon.png"));

writeFileSync(
  join(root, "src/data/brand-logo-meta.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: { width: sourceMeta.width, height: sourceMeta.height },
      ui: { width: ui.width, height: ui.height, aspectRatio: ui.width / ui.height },
      primary: { width: sourceMeta.width, height: sourceMeta.height },
    },
    null,
    2,
  ),
);

console.log("Brand assets generated.");
