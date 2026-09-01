import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const input = resolve(root, process.argv[2] || "assets/images/implant-restoration-lab-v1-alpha.png");
const output = resolve(root, process.argv[3] || "assets/images/implant-restoration-lab-v1-alpha.png");

const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const scanLeft = Math.round(width * .19);
const scanRight = Math.round(width * .47);
// Stop at the last row of the fixture threads. The white collar and gray
// spindle below it are a photography stand, not part of the implant.
const implantBottom = Math.round(height * .601);
const leftEdges = new Int32Array(height).fill(-1);
const rightEdges = new Int32Array(height).fill(-1);

const isCheckerboard = (offset) => {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const darkest = Math.min(red, green, blue);
  const brightest = Math.max(red, green, blue);
  return darkest >= 244 && brightest - darkest <= 8;
};

for (let y = 0; y <= implantBottom; y += 1) {
  let left = -1;
  let right = -1;
  for (let x = scanLeft; x <= scanRight; x += 1) {
    const offset = (y * width + x) * channels;
    if (isCheckerboard(offset)) continue;
    if (left < 0) left = x;
    right = x;
  }

  if (right - left >= 8) {
    leftEdges[y] = left;
    rightEdges[y] = right;
  }
}

const medianEdge = (values, y) => {
  const window = [];
  for (let row = Math.max(0, y - 2); row <= Math.min(implantBottom, y + 2); row += 1) {
    if (values[row] >= 0) window.push(values[row]);
  }
  if (!window.length) return -1;
  window.sort((a, b) => a - b);
  return window[Math.floor(window.length / 2)];
};

const rgba = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y += 1) {
  const left = y <= implantBottom ? medianEdge(leftEdges, y) : -1;
  const right = y <= implantBottom ? medianEdge(rightEdges, y) : -1;

  for (let x = 0; x < width; x += 1) {
    const source = (y * width + x) * channels;
    const target = (y * width + x) * 4;
    rgba[target] = data[source];
    rgba[target + 1] = data[source + 1];
    rgba[target + 2] = data[source + 2];

    if (left < 0 || x < left || x > right) {
      rgba[target + 3] = 0;
      continue;
    }

    const edgeDistance = Math.min(x - left, right - x);
    rgba[target + 3] = Math.min(255, Math.max(0, edgeDistance * 110));
  }
}

await sharp(rgba, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);

console.log(output);
