import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const images = resolve(root, "assets/images");
const sourcePath = resolve(images, "implant-restoration-lab-v2-ai.png");
const canvas = { width: 3316, height: 1898 };
const ROOT_CENTER_X = 1080;
const ROOT_VISIBLE_END_Y = 650;
const ROOT_EXTENDED_END_Y = 676;

const { data: source, info } = await sharp(sourcePath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const productRgba = Buffer.alloc(width * height * 4);
const productAlpha = Buffer.alloc(width * height);

// The crown uses a trimap: a guaranteed foreground core, a guaranteed
// background outside the outer contour, and a narrow unknown band between
// them. This retains A's visible silhouette without baking its beige backdrop
// into B's anti-aliased edge.
const crownInnerControl = [
  [1080, 210], [1058, 207], [1037, 219], [1019, 216], [1006, 235],
  [999, 263], [999, 312], [1007, 342], [1020, 361], [1034, 371],
  [1141, 371], [1154, 362], [1164, 339], [1170, 301], [1167, 258],
  [1159, 231], [1145, 216], [1129, 216], [1107, 223],
];
const crownOuterControl = [
  [1080, 202], [1057, 199], [1035, 210], [1015, 207], [996, 225],
  [989, 257], [989, 315], [994, 335], [1000, 350], [1014, 371], [1030, 380],
  [1143, 380], [1155, 362], [1161, 342], [1171, 320], [1180, 304], [1177, 253],
  [1168, 222], [1149, 207], [1129, 207], [1107, 214],
];
const crownCenter = [1083, 292];
const abutmentOuter = [
  [1027, 370], [1141, 370], [1137, 389], [1122, 407],
  [1115, 445], [1043, 445], [1038, 407], [1031, 389],
];
function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index];
    const [xj, yj] = polygon[previous];
    const crosses = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function smoothClosedContour(points, stepsPerSegment = 10, tension = .38) {
  const contour = [];
  const count = points.length;
  for (let index = 0; index < count; index += 1) {
    const p0 = points[(index - 1 + count) % count];
    const p1 = points[index];
    const p2 = points[(index + 1) % count];
    const p3 = points[(index + 2) % count];
    const tangent1 = [(p2[0] - p0[0]) * tension, (p2[1] - p0[1]) * tension];
    const tangent2 = [(p3[0] - p1[0]) * tension, (p3[1] - p1[1]) * tension];
    for (let step = 0; step < stepsPerSegment; step += 1) {
      const t = step / stepsPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      contour.push([
        h00 * p1[0] + h10 * tangent1[0] + h01 * p2[0] + h11 * tangent2[0],
        h00 * p1[1] + h10 * tangent1[1] + h01 * p2[1] + h11 * tangent2[1],
      ]);
    }
  }
  return contour;
}

const crownInner = smoothClosedContour(crownInnerControl, 8, .3);
const crownOuter = smoothClosedContour(crownOuterControl, 12, .34);

function rootSourceY(y) {
  if (y <= ROOT_VISIBLE_END_Y) return y;
  // A is exact through the holder contact. Only the newly revealed 26 source
  // pixels sample clean fixture texture from above the holder.
  return 620 + (y - ROOT_VISIBLE_END_Y) * .58;
}

function smoothstep(value) {
  const normalized = Math.max(0, Math.min(1, value));
  return normalized * normalized * (3 - 2 * normalized);
}

function sourceColorAt(x, y) {
  const sourceX = Math.max(0, Math.min(width - 1, Math.round(x)));
  const sourceY = Math.max(0, Math.min(height - 1, Math.round(y)));
  const offset = (sourceY * width + sourceX) * channels;
  return [source[offset], source[offset + 1], source[offset + 2]];
}

const backgroundRows = new Map();
function averageRowColor(y, startX, endX) {
  const sum = [0, 0, 0];
  for (let x = startX; x <= endX; x += 1) {
    const color = sourceColorAt(x, y);
    color.forEach((value, channel) => { sum[channel] += value; });
  }
  const count = endX - startX + 1;
  return sum.map((value) => value / count);
}

function backgroundColorAt(y, x) {
  if (!backgroundRows.has(y)) {
    backgroundRows.set(y, {
      left: averageRowColor(y, 962, 978),
      right: averageRowColor(y, 1190, 1206),
    });
  }
  const { left, right } = backgroundRows.get(y);
  const progress = Math.max(0, Math.min(1, (x - 978) / 212));
  return left.map((value, channel) => value + (right[channel] - value) * progress);
}

const rootRows = new Map();
function detectedRootBounds(y) {
  if (rootRows.has(y)) return rootRows.get(y);
  const foregroundXs = [];
  for (let x = 1038; x <= 1122; x += 1) {
    const color = sourceColorAt(x, y);
    const background = backgroundColorAt(y, x);
    const difference = Math.hypot(
      color[0] - background[0],
      color[1] - background[1],
      color[2] - background[2],
    );
    if (difference > 9) foregroundXs.push(x);
  }
  const fallback = { left: 1049, right: 1111, center: ROOT_CENTER_X, half: 31 };
  if (foregroundXs.length < 20) {
    rootRows.set(y, fallback);
    return fallback;
  }
  let left = Math.min(...foregroundXs);
  let right = Math.max(...foregroundXs);
  if (right - left > 72) {
    left = fallback.left;
    right = fallback.right;
  }
  const bounds = {
    left,
    right,
    center: (left + right) / 2,
    half: (right - left) / 2,
  };
  rootRows.set(y, bounds);
  return bounds;
}

const extensionReferenceBounds = detectedRootBounds(640);
function rootGeometryAt(y) {
  if (y < 442 || y > ROOT_EXTENDED_END_Y) return null;
  if (y <= ROOT_VISIBLE_END_Y) return detectedRootBounds(y);
  const progress = (y - ROOT_VISIBLE_END_Y) / (ROOT_EXTENDED_END_Y - ROOT_VISIBLE_END_Y);
  const half = extensionReferenceBounds.half * Math.pow(Math.max(0, 1 - progress), .62);
  return {
    left: extensionReferenceBounds.center - half,
    right: extensionReferenceBounds.center + half,
    center: extensionReferenceBounds.center,
    half,
  };
}

function crownForegroundColorAt(x, y) {
  const deltaX = crownCenter[0] - x;
  const deltaY = crownCenter[1] - y;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  for (let step = 2; step <= 24; step += 2) {
    const sampleX = x + deltaX / distance * step;
    const sampleY = y + deltaY / distance * step;
    if (pointInPolygon(sampleX, sampleY, crownInner)) {
      return { color: sourceColorAt(sampleX, sampleY), step };
    }
  }
  return { color: sourceColorAt(crownCenter[0], crownCenter[1]), step: 24 };
}

for (let y = 190; y <= ROOT_EXTENDED_END_Y; y += 1) {
  for (let x = 982; x <= 1184; x += 1) {
    const rootGeometry = rootGeometryAt(y);
    const inCrownInner = pointInPolygon(x, y, crownInner);
    const inCrownOuter = pointInPolygon(x, y, crownOuter);
    const inAbutmentOuter = pointInPolygon(x, y, abutmentOuter);
    const inRoot = rootGeometry && x >= rootGeometry.left && x <= rootGeometry.right;
    const inOuter = inCrownOuter || inAbutmentOuter || inRoot;
    if (!inOuter) continue;

    const sampleY = inRoot ? rootSourceY(y) : y;
    const rootSampleScale = inRoot && y > ROOT_VISIBLE_END_Y && rootGeometry.half > 0
      ? extensionReferenceBounds.half / rootGeometry.half
      : 1;
    const sampleX = inRoot
      ? extensionReferenceBounds.center
        + (x - rootGeometry.center) * rootSampleScale
      : x;
    const sourceX = Math.max(0, Math.min(width - 1, Math.round(sampleX)));
    const sourceY = Math.max(0, Math.min(height - 1, Math.round(sampleY)));
    const sourceOffset = (sourceY * width + sourceX) * channels;
    const sourceColor = [source[sourceOffset], source[sourceOffset + 1], source[sourceOffset + 2]];
    let alpha = inCrownInner ? 255 : 0;
    let outputColor = sourceColor;

    if (inCrownOuter && !inCrownInner) {
      const { color: foreground, step } = crownForegroundColorAt(x, y);
      alpha = 255;
      // The unknown band's RGB comes from the nearest sure-foreground pixel.
      // Lanczos supersampling creates the final 1px alpha ramp without
      // carrying A's beige backdrop into B.
      const foregroundMix = Math.min(1, step / 8);
      outputColor = foreground.map(
        (value, channel) => value * foregroundMix + sourceColor[channel] * (1 - foregroundMix),
      );
    } else if (inRoot) {
      const edgeDistance = Math.min(x - rootGeometry.left, rootGeometry.right - x);
      alpha = Math.round(255 * smoothstep((edgeDistance + .5) / 1.5));
      if (edgeDistance < 4) {
        const direction = Math.sign(sampleX - extensionReferenceBounds.center);
        outputColor = sourceColorAt(sampleX - direction * (4 - edgeDistance), sampleY);
      }
    } else if (inAbutmentOuter) {
      alpha = 255;
    }
    if (alpha === 0) continue;

    const targetOffset = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      productRgba[targetOffset + channel] = Math.round(outputColor[channel]);
    }
    productAlpha[y * width + x] = alpha;
  }
}

// The mask is deterministic, so a median filter would only flatten the crown's
// curved edge. The final 2x Lanczos pass provides the one-pixel alpha ramp.
const cleanedAlpha = productAlpha;

// Keep only the component connected to the crown. Background texture in the
// unknown crown band can have a similar colour, but it cannot become part of
// the product unless it connects to this seeded component.
const connected = Buffer.alloc(cleanedAlpha.length);
const queue = [Math.round(crownCenter[1]) * width + Math.round(crownCenter[0])];
connected[queue[0]] = 1;
for (let cursor = 0; cursor < queue.length; cursor += 1) {
  const index = queue[cursor];
  const x = index % width;
  const neighbours = [index - width, index + width];
  if (x > 0) neighbours.push(index - 1);
  if (x < width - 1) neighbours.push(index + 1);
  neighbours.forEach((neighbour) => {
    if (
      neighbour >= 0
      && neighbour < cleanedAlpha.length
      && !connected[neighbour]
      && cleanedAlpha[neighbour] > 3
    ) {
      connected[neighbour] = 1;
      queue.push(neighbour);
    }
  });
}
for (let index = 0; index < cleanedAlpha.length; index += 1) {
  productRgba[index * 4 + 3] = connected[index] ? cleanedAlpha[index] : 0;
}

const originalScene2x = await sharp(sourcePath)
  .resize(canvas.width, canvas.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();

await sharp(productRgba, { raw: { width, height, channels: 4 } })
  .resize(canvas.width, canvas.height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(resolve(images, "implant-restoration-product-master-2x-alpha.png"));

await sharp(originalScene2x)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(resolve(images, "implant-restoration-lab-v1-2x.png"));

console.log("A and pixel-matched B generated from the same redrawn 3316x1898 source.");
