import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(currentDir, "../..");
const imageDir = path.join(projectDir, "assets/images");

const canvasWidth = 1200;
const canvasHeight = 630;
const buildingWidth = 690;
const visibleBuildingWidth = 580;
const buildingLeft = canvasWidth - visibleBuildingWidth;

const { data: referencePixels, info: referenceInfo } = await sharp(
  path.join(imageDir, "og-type-reference-source.png"),
)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const extractedPixels = Buffer.alloc(
  referenceInfo.width * referenceInfo.height * 4,
);

for (let pixel = 0; pixel < referenceInfo.width * referenceInfo.height; pixel += 1) {
  const sourceOffset = pixel * referenceInfo.channels;
  const targetOffset = pixel * 4;
  const red = referencePixels[sourceOffset];
  const green = referencePixels[sourceOffset + 1];
  const blue = referencePixels[sourceOffset + 2];
  const minimum = Math.min(red, green, blue);
  const chroma = Math.max(red, green, blue) - minimum;
  const alpha = Math.max(
    0,
    Math.min(255, Math.round((minimum - 148) * 2.6 - chroma * 1.8)),
  );

  extractedPixels[targetOffset] = 255;
  extractedPixels[targetOffset + 1] = 255;
  extractedPixels[targetOffset + 2] = 255;
  extractedPixels[targetOffset + 3] = alpha;
}

const extractedType = await sharp(extractedPixels, {
  raw: {
    width: referenceInfo.width,
    height: referenceInfo.height,
    channels: 4,
  },
})
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer({ resolveWithObject: true });

const recoloredTypePixels = await sharp(extractedType.data)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (
  let pixel = 0;
  pixel < recoloredTypePixels.info.width * recoloredTypePixels.info.height;
  pixel += 1
) {
  const offset = pixel * recoloredTypePixels.info.channels;
  const row = Math.floor(pixel / recoloredTypePixels.info.width);
  const isSubtitle = row < recoloredTypePixels.info.height * 0.34;
  const color = isSubtitle ? [49, 130, 246] : [25, 31, 40];

  recoloredTypePixels.data[offset] = color[0];
  recoloredTypePixels.data[offset + 1] = color[1];
  recoloredTypePixels.data[offset + 2] = color[2];
}

const typography = await sharp(recoloredTypePixels.data, {
  raw: {
    width: recoloredTypePixels.info.width,
    height: recoloredTypePixels.info.height,
    channels: 4,
  },
})
  .resize({ width: 620, kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer();

const background = await sharp(
  path.join(imageDir, "og-toss-official-clean-base.png"),
)
  .resize({ width: canvasWidth, height: 675, fit: "fill" })
  .extract({ left: 0, top: 22, width: canvasWidth, height: canvasHeight })
  .png()
  .toBuffer();

const resizedBuilding = await sharp(
  path.join(imageDir, "clinic-exterior-actual.png"),
)
  .resize({ width: buildingWidth, kernel: sharp.kernel.lanczos3 })
  .png()
  .toBuffer({ resolveWithObject: true });

const visibleBuilding = await sharp(resizedBuilding.data)
  .extract({
    left: 0,
    top: 0,
    width: visibleBuildingWidth,
    height: resizedBuilding.info.height,
  })
  .png()
  .toBuffer();

await sharp(background)
  .composite([
    { input: typography, left: 40, top: 228 },
    {
      input: visibleBuilding,
      left: buildingLeft,
      top: canvasHeight - resizedBuilding.info.height,
    },
  ])
  .png()
  .toFile(
    path.join(imageDir, "og-365-seoul-gamdong-generated-02.png"),
  );
