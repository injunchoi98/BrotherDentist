import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(currentDir, "../..");
const imageDir = path.join(projectDir, "assets/images");
const canvasWidth = 1200;
const canvasHeight = 630;
const buildingWidth = 640;
const visibleBuildingWidth = 540;
const buildingLeft = canvasWidth - visibleBuildingWidth;

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

for (let variant = 1; variant <= 5; variant += 1) {
  const suffix = String(variant).padStart(2, "0");
  const basePath = path.join(imageDir, `og-generated-base-${variant}.png`);
  const outputPath = path.join(
    imageDir,
    `og-365-seoul-gamdong-generated-${suffix}.png`,
  );

  await sharp(basePath)
    .resize({ width: canvasWidth, height: canvasHeight, fit: "fill" })
    .composite([
      {
        input: visibleBuilding,
        left: buildingLeft,
        top: canvasHeight - resizedBuilding.info.height,
      },
    ])
    .png()
    .toFile(outputPath);
}
