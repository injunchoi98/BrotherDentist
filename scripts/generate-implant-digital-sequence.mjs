import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const FRAME_COUNT = 106;
const WORKER_COUNT = 6;
const DELIVERY_WIDTH = 920;
const DELIVERY_HEIGHT = 800;
const CONTENT_WIDTH = 920;
const CONTENT_HEIGHT = 800;
const DELIVERY_BACKGROUND = { r: 0, g: 1, b: 7 };
const DELIVERY_QUALITY = 92;
const TRANSITION_FROM_FRAME = 58;
const TRANSITION_TO_FRAME = 66;
const FRAME_PATTERN = /^story-frame-(\d{3})\.png$/;
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceDirectory = resolve(
  root,
  "../implant-3d-work/renders/story-material-v15-reference-angles/png",
);
const outputDirectory = resolve(root, "assets/images/implant-digital-sequence");

const sourceFiles = (await readdir(sourceDirectory))
  .filter((file) => FRAME_PATTERN.test(file))
  .sort((left, right) => left.localeCompare(right));

if (sourceFiles.length !== FRAME_COUNT) {
  throw new Error(`Expected ${FRAME_COUNT} rendered PNG frames, found ${sourceFiles.length}`);
}

for (let index = 0; index < FRAME_COUNT; index += 1) {
  const expectedName = `story-frame-${String(index + 1).padStart(3, "0")}.png`;
  if (sourceFiles[index] !== expectedName) {
    throw new Error(`Missing rendered frame: ${expectedName}`);
  }
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
sharp.cache(false);

let nextIndex = 0;
let sourceBytes = 0;

const prepareFrame = (source) =>
  sharp(source)
    .rotate()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 3 })
    .resize(CONTENT_WIDTH, CONTENT_HEIGHT, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .extend({
      top: (DELIVERY_HEIGHT - CONTENT_HEIGHT) / 2,
      bottom: (DELIVERY_HEIGHT - CONTENT_HEIGHT) / 2,
      left: (DELIVERY_WIDTH - CONTENT_WIDTH) / 2,
      right: (DELIVERY_WIDTH - CONTENT_WIDTH) / 2,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

const workers = Array.from({ length: WORKER_COUNT }, async () => {
  while (nextIndex < sourceFiles.length) {
    const index = nextIndex;
    nextIndex += 1;
    const sourceFile = sourceFiles[index];
    const source = resolve(sourceDirectory, sourceFile);
    const output = resolve(outputDirectory, sourceFile.replace(/\.png$/, ".webp"));
    sourceBytes += (await stat(source)).size;
    await prepareFrame(source)
      .webp({ quality: DELIVERY_QUALITY, alphaQuality: 100, effort: 6, smartSubsample: true })
      .toFile(output);
  }
});

await Promise.all(workers);

// Blender's layered alpha materials create order-dependent facets when their
// opacity changes together.  Frames 48 and 56 share the exact same camera, so
// replace the intermediate delivery frames with a deterministic pixel dissolve
// between the two fully rendered endpoints.
const transitionEndpoint = async (frame) => {
  const source = resolve(
    sourceDirectory,
    `story-frame-${String(frame).padStart(3, "0")}.png`,
  );
  const prepared = await prepareFrame(source).png().toBuffer();
  return sharp(prepared)
    .flatten({ background: DELIVERY_BACKGROUND })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
};

const [ctEndpoint, naturalEndpoint] = await Promise.all([
  transitionEndpoint(TRANSITION_FROM_FRAME),
  transitionEndpoint(TRANSITION_TO_FRAME),
]);

if (
  ctEndpoint.info.width !== naturalEndpoint.info.width ||
  ctEndpoint.info.height !== naturalEndpoint.info.height ||
  ctEndpoint.info.channels !== naturalEndpoint.info.channels
) {
  throw new Error("Transition endpoint dimensions do not match");
}

for (let frame = TRANSITION_FROM_FRAME + 1; frame < TRANSITION_TO_FRAME; frame += 1) {
  const linearProgress =
    (frame - TRANSITION_FROM_FRAME) / (TRANSITION_TO_FRAME - TRANSITION_FROM_FRAME);
  const progress = linearProgress * linearProgress * (3 - 2 * linearProgress);
  const pixels = Buffer.allocUnsafe(ctEndpoint.data.length);
  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = Math.round(
      ctEndpoint.data[index] * (1 - progress) + naturalEndpoint.data[index] * progress,
    );
  }

  const output = resolve(
    outputDirectory,
    `story-frame-${String(frame).padStart(3, "0")}.webp`,
  );
  await sharp(pixels, {
    raw: {
      width: ctEndpoint.info.width,
      height: ctEndpoint.info.height,
      channels: ctEndpoint.info.channels,
    },
  })
    .webp({ quality: DELIVERY_QUALITY, effort: 6, smartSubsample: true })
    .toFile(output);
}

let outputBytes = 0;
for (const outputFile of await readdir(outputDirectory)) {
  outputBytes += (await stat(resolve(outputDirectory, outputFile))).size;
}

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`Implant sequence generated: ${FRAME_COUNT} WebP frames`);
console.log(`PNG source: ${megabytes(sourceBytes)} / WebP delivery: ${megabytes(outputBytes)}`);
