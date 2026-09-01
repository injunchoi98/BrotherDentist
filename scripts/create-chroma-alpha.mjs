import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const input = resolve(root, process.argv[2]);
const output = resolve(root, process.argv[3]);
const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const rgba = Buffer.alloc(width * height * 4);

// The image generator uses a gently varied green plate instead of one exact
// RGB value. Green-channel dominance therefore gives a cleaner matte than a
// fixed-color comparison and retains the antialiasing around metal and ceramic.
const opaqueDominance = Number(process.argv[4] || 28);
const transparentDominance = Number(process.argv[5] || 150);

for (let pixel = 0; pixel < width * height; pixel += 1) {
  const source = pixel * channels;
  const target = pixel * 4;
  const red = data[source];
  const green = data[source + 1];
  const blue = data[source + 2];
  const dominance = 255 * (green - Math.max(red, blue)) / Math.max(green, 1);
  const alpha = Math.round(255 * Math.max(0, Math.min(1,
    1 - ((dominance - opaqueDominance) / (transparentDominance - opaqueDominance)),
  )));

  rgba[target] = red;
  rgba[target + 1] = alpha < 255 ? Math.min(green, Math.max(red, blue) + 8) : green;
  rgba[target + 2] = blue;
  rgba[target + 3] = alpha;
}

await sharp(rgba, { raw: { width, height, channels: 4 } })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 4 })
  .extend({
    top: 24,
    right: 24,
    bottom: 24,
    left: 24,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);

console.log(output);
