/**
 * Phase 8.63 brand asset builder
 */
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE = join(root, "public/brand/emojiquick-logo-official-source.png");
const OUT = join(root, "public/brand");
const APP = join(root, "src/app");
const BG = { r: 252, g: 252, b: 250 };

if (!existsSync(SOURCE)) {
  console.error("Missing official logo source:", SOURCE);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const meta = await sharp(SOURCE).metadata();
const W = meta.width ?? 1024;
const H = meta.height ?? 558;
console.log("Source:", W + "x" + H);

await sharp(SOURCE).png({ compressionLevel: 9 }).toFile(join(OUT, "emojiquick-logo-primary.png"));
await sharp(SOURCE).webp({ quality: 92 }).toFile(join(OUT, "emojiquick-logo-primary.webp"));

const mascotSize = Math.round(Math.min(W * 0.72, H * 0.72));
const mascotLeft = Math.round((W - mascotSize) / 2);
const mascotTop = Math.round(H * 0.02);
const mascotSquare = await sharp(SOURCE)
  .extract({ left: mascotLeft, top: mascotTop, width: mascotSize, height: mascotSize })
  .resize(512, 512, { fit: "cover", position: "centre" })
  .png()
  .toBuffer();
await sharp(mascotSquare).toFile(join(OUT, "emojiquick-icon.png"));

for (const size of [16, 32, 48, 96, 180, 192, 256, 512]) {
  await sharp(mascotSquare)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "favicon-" + size + ".png"));
}

const ogLogo = await sharp(SOURCE).resize(900).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: BG } })
  .composite([{ input: ogLogo, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, "emojiquick-og.png"));

const og4kLogo = await sharp(SOURCE).resize(2400).png().toBuffer();
await sharp({ create: { width: 3840, height: 2160, channels: 3, background: BG } })
  .composite([{ input: og4kLogo, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(join(OUT, "emojiquick-logo-primary-4k.png"));

copyFileSync(join(OUT, "favicon-32.png"), join(APP, "icon.png"));
copyFileSync(join(OUT, "favicon-180.png"), join(APP, "apple-icon.png"));
console.log("Brand assets generated.");