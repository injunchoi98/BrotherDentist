import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourcePath = resolve(root, "assets/images/implant-restoration-lab-v1.png");
const backgroundPath = resolve(root, "assets/images/implant-restoration-clean-background-v2.png");
const implantOutput = resolve(root, "assets/images/implant-restoration-scene-implant-alpha.png");
const holderOutput = resolve(root, "assets/images/implant-restoration-scene-holder-alpha.png");

const backgroundMetadata = await sharp(backgroundPath).metadata();
const width = backgroundMetadata.width;
const height = backgroundMetadata.height;

if (!width || !height) throw new Error("Unable to read restoration background dimensions.");

const source = await sharp(sourcePath)
  .resize(width, height, { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer();
const background = await sharp(backgroundPath)
  .removeAlpha()
  .raw()
  .toBuffer();

const scanLeft = Math.round(width * .21);
const scanRight = Math.round(width * .47);
const differenceThreshold = 10;
const leftEdges = new Int32Array(height).fill(-1);
const rightEdges = new Int32Array(height).fill(-1);

for (let y = 0; y < height; y += 1) {
  let left = -1;
  let right = -1;

  for (let x = scanLeft; x <= scanRight; x += 1) {
    const offset = (y * width + x) * 3;
    const difference = Math.max(
      Math.abs(source[offset] - background[offset]),
      Math.abs(source[offset + 1] - background[offset + 1]),
      Math.abs(source[offset + 2] - background[offset + 2]),
    );

    if (difference <= differenceThreshold) continue;
    if (left < 0) left = x;
    right = x;
  }

  if (right - left >= 8) {
    leftEdges[y] = left;
    rightEdges[y] = right;
  }
}

const medianEdge = (edges, y) => {
  const values = [];
  for (let row = Math.max(0, y - 2); row <= Math.min(height - 1, y + 2); row += 1) {
    if (edges[row] >= 0) values.push(edges[row]);
  }
  if (!values.length) return -1;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};

const writeLayer = async ({ output, minY, maxY }) => {
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const left = y >= minY && y <= maxY ? medianEdge(leftEdges, y) : -1;
    const right = y >= minY && y <= maxY ? medianEdge(rightEdges, y) : -1;

    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (y * width + x) * 3;
      const targetOffset = (y * width + x) * 4;
      rgba[targetOffset] = source[sourceOffset];
      rgba[targetOffset + 1] = source[sourceOffset + 1];
      rgba[targetOffset + 2] = source[sourceOffset + 2];

      if (left < 0 || x < left || x > right) {
        rgba[targetOffset + 3] = 0;
        continue;
      }

      const edgeDistance = Math.min(x - left, right - x);
      rgba[targetOffset + 3] = Math.min(255, (edgeDistance + 1) * 110);
    }
  }

  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
};

// The metal fixture ends at row 629, immediately before the white photography
// collar. A two-row overlap keeps the assembled photograph seamless without
// leaving a white collar fragment attached to the persistent implant.
await writeLayer({ output: implantOutput, minY: 150, maxY: 629 });
await writeLayer({ output: holderOutput, minY: 628, maxY: height - 1 });

console.log(implantOutput);
console.log(holderOutput);
