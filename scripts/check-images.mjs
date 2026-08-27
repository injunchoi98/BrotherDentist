import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const files = [
  "index.html",
  "src/components/coverflow.js",
  "src/components/doctor-gallery.js",
  "src/components/review-marquee.js",
];
const source = (await Promise.all(files.map((file) => readFile(resolve(root, file), "utf8")))).join("\n");
const styles = await readFile(resolve(root, "src/styles.css"), "utf8");
const viewportState = await readFile(resolve(root, "src/utils/viewport-state.js"), "utf8");
const main = await readFile(resolve(root, "src/main.js"), "utf8");

const assertions = [
  [source.match(/\.webp/g)?.length >= 20, "responsive WebP sources are missing"],
  [source.match(/srcset=/g)?.length >= 20, "responsive srcset coverage is too low"],
  [source.match(/loading=["']lazy["']/g)?.length >= 20, "below-the-fold images must use native lazy loading"],
  [styles.includes("content-visibility: auto"), "content-visibility auto is not enabled"],
  [viewportState.includes("pinningAllowed: !isMobile"), "mobile pinning must be disabled in the shared viewport state"],
  [!main.includes("Promise.all([...document.images]"), "decoding every image defeats native lazy loading"],
];

for (const [valid, message] of assertions) {
  if (!valid) throw new Error(message);
}

for (const file of [
  "patient-poses-transparent-1254.webp",
  "clinic-day-night-wheel-1254.webp",
  "clinic-showcase-night-480.webp",
  "clinic-showcase-night-1387.webp",
]) {
  await access(resolve(root, "assets/images/webp", file));
}

console.log("Image delivery contract passed: WebP, srcset, lazy loading, content visibility, and mobile pin fallback.");
