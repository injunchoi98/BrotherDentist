import { mkdir, rm, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = resolve(root, "assets/images/webp");

const variants = [
  ["clinic-exterior.png", [480, 960, 1440]],
  ["clinic-hero-poster.jpg", [960, 1920]],
  ["patient-poses-transparent.png", [1254]],
  ["clinic-day-night-wheel.png", [1254]],
  ["clinic-exterior-actual.png", [480, 770]],
  ["clinic-showcase-night.png", [480, 960, 1387]],
  ["case-general.png", [480, 960, 1440]],
  ["case-implant.png", [480, 960, 1440]],
  ["case-whitening.png", [480, 960, 1440]],
  ["consultation.png", [480, 960, 1440]],
  ["digital-safety.png", [480, 960, 1440]],
  ["treatment-scene.png", [480, 960, 1440]],
  ["anesthesia-care-v2.png", [480, 960, 1440]],
  ["evidence-friendly.png", [285, 570]],
  ["treatment-implant-clean.png", [480, 960, 1122]],
  ["implant-restoration-lab-v1.png", [480, 960, 1536]],
  ["implant-restoration-clean-background-v2.png", [480, 960, 1658]],
  ["implant-restoration-scene-implant-alpha.png", [480, 960, 1658]],
  ["implant-restoration-scene-holder-alpha.png", [480, 960, 1658]],
  ["implant-restoration-complete-v3-alpha.png", [190, 379]],
  ["implant-product-complete-2x-alpha.png", [240, 480]],
  ["implant-holder-2x-alpha.png", [348, 695]],
  ["treatment-room.png", [480, 960, 1440]],
  ["treatment-whitening-v2.png", [480, 960, 1122]],
  ["doctor-lee-jungwoong.png", [266, 532]],
  ["doctor-lee-myung-hoon.png", [266, 532]],
  ["doctor-kim-yoonhee.png", [266, 532]],
  ["doctor-yeo-sangwon.png", [266, 532]],
  ["equipment-01.png", [285, 570]],
  ["equipment-02.png", [285, 570]],
  ["equipment-03.png", [285, 570]],
  ["equipment-04.png", [285, 570]],
  ["equipment-05.png", [285, 570]],
  ["equipment-07.png", [285, 570]],
  ["visit-map-placeholder.png", [480, 960, 1600]],
  ["review-profile-01.jpg", [48, 96]],
  ["review-profile-02.jpg", [48, 96]],
  ["review-profile-03.jpg", [48, 96]],
  ["review-profile-04.jpg", [48, 96]],
  ["review-profile-05.jpg", [48, 96]],
  ["review-profile-06.png", [48, 96]],
];

const losslessAlphaSources = new Set([
  "implant-product-complete-2x-alpha.png",
  "implant-holder-2x-alpha.png",
]);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
sharp.cache(false);

let sourceBytes = 0;
let outputBytes = 0;
let outputCount = 0;

for (const [file, widths] of variants) {
  const source = resolve(root, "assets/images", file);
  const sourceStats = await stat(source);
  const metadata = await sharp(source).metadata();
  const pixelStats = await sharp(source).stats();
  sourceBytes += sourceStats.size;

  for (const requestedWidth of widths) {
    const width = Math.min(requestedWidth, metadata.width || requestedWidth);
    const stem = basename(file).replace(/\.[^.]+$/, "");
    const output = resolve(outputDirectory, `${stem}-${width}.webp`);
    const webpOptions = losslessAlphaSources.has(file)
      ? { lossless: true, effort: 6 }
      : { quality: 80, alphaQuality: 92, effort: 6, smartSubsample: true };
    await sharp(source)
      .rotate()
      .resize({ width, fit: "inside", withoutEnlargement: true })
      .webp(webpOptions)
      .toFile(output);
    const generatedMetadata = await sharp(output).metadata();
    if (!pixelStats.isOpaque && !generatedMetadata.hasAlpha) {
      throw new Error(`Alpha channel was lost while converting ${file}`);
    }
    outputBytes += (await stat(output)).size;
    outputCount += 1;
  }
}

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`Responsive images generated: ${outputCount} WebP files`);
console.log(`Source set: ${megabytes(sourceBytes)} / responsive WebP set: ${megabytes(outputBytes)}`);
