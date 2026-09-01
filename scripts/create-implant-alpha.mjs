import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const input = resolve(root, process.argv[2] || "assets/images/implant-from-holding-cutout-v2.png");
const output = resolve(root, process.argv[3] || "assets/images/implant-from-holding-cutout-alpha.png");
const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const pixels = width * height;
const labels = new Int32Array(pixels);
const queue = new Int32Array(pixels);

const isForeground = (pixel) => {
  const offset = pixel * channels;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  return !(darkest >= 246 && brightest - darkest <= 5);
};

let label = 0;
let largestLabel = 0;
let largestSize = 0;
for (let start = 0; start < pixels; start += 1) {
  if (labels[start] || !isForeground(start)) continue;
  label += 1;
  let head = 0;
  let tail = 0;
  let size = 0;
  labels[start] = label;
  queue[tail++] = start;
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    size += 1;
    for (const neighbor of [x > 0 ? pixel - 1 : -1, x + 1 < width ? pixel + 1 : -1, y > 0 ? pixel - width : -1, y + 1 < height ? pixel + width : -1]) {
      if (neighbor < 0 || labels[neighbor] || !isForeground(neighbor)) continue;
      labels[neighbor] = label;
      queue[tail++] = neighbor;
    }
  }
  if (size > largestSize) {
    largestSize = size;
    largestLabel = label;
  }
}

const anchorX = Math.floor(width * .5);
const anchorY = Math.floor(height * .68);
const anchoredLabel = labels[anchorY * width + anchorX];
if (anchoredLabel) largestLabel = anchoredLabel;

const outside = new Uint8Array(pixels);
let head = 0;
let tail = 0;
const enqueueOutside = (pixel) => {
  if (outside[pixel] || labels[pixel] === largestLabel) return;
  outside[pixel] = 1;
  queue[tail++] = pixel;
};
for (let x = 0; x < width; x += 1) {
  enqueueOutside(x);
  enqueueOutside((height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  enqueueOutside(y * width);
  enqueueOutside(y * width + width - 1);
}
while (head < tail) {
  const pixel = queue[head++];
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  if (x > 0) enqueueOutside(pixel - 1);
  if (x + 1 < width) enqueueOutside(pixel + 1);
  if (y > 0) enqueueOutside(pixel - width);
  if (y + 1 < height) enqueueOutside(pixel + width);
}

const rgba = Buffer.alloc(pixels * 4);
for (let pixel = 0; pixel < pixels; pixel += 1) {
  const source = pixel * channels;
  const target = pixel * 4;
  rgba[target] = data[source];
  rgba[target + 1] = data[source + 1];
  rgba[target + 2] = data[source + 2];
  rgba[target + 3] = outside[pixel] ? 0 : 255;
}

await sharp(rgba, { raw: { width, height, channels: 4 } })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 48, right: 48, bottom: 48, left: 48, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);

console.log(output);
