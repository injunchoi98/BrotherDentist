import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
  PAGE_FILES,
  SEO_IMAGE_PATH,
  SITE_URL,
  renderRobots,
  renderSeoHead,
  renderSitemap,
} from "./seo.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const assetRoot = resolve(root, "assets");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "src"), { recursive: true });

await build({
  entryPoints: {
    main: resolve(root, "src/main.js"),
    "implant-scenes": resolve(root, "src/implant-scenes.js"),
    general: resolve(root, "src/general.js"),
    whitening: resolve(root, "src/whitening.js"),
    location: resolve(root, "src/location.js"),
  },
  outdir: resolve(dist, "src"),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2020"],
  sourcemap: true,
});

await build({
  entryPoints: {
    styles: resolve(root, "src/styles.css"),
    "implant-scenes": resolve(root, "src/implant-scenes.css"),
    general: resolve(root, "src/general.css"),
    whitening: resolve(root, "src/whitening.css"),
    location: resolve(root, "src/location.css"),
  },
  outdir: resolve(dist, "src"),
  bundle: true,
  external: ["../assets/*"],
  minify: false,
  target: ["es2020"],
});

// These pages load the generated browser bundles directly. A copied source
// module with a bare package import would fail after deployment.
for (const bundleName of ["implant-scenes.js", "general.js", "whitening.js", "location.js"]) {
  const bundle = await readFile(resolve(dist, "src", bundleName), "utf8");
  if (/\bfrom\s*["']gsap(?:\/ScrollTrigger)?["']/.test(bundle)) {
    throw new Error(`${bundleName} must be the bundled browser entry`);
  }
}

const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1];

const largestSrcsetUrl = (srcset) => srcset
  .split(",")
  .map((candidate) => {
    const [url, descriptor = "0w"] = candidate.trim().split(/\s+/);
    return { url, width: Number.parseInt(descriptor, 10) || 0 };
  })
  .sort((a, b) => b.width - a.width)[0]?.url;

const replaceImageSource = (tag, source) => {
  if (!source) return tag;
  return /\bsrc=["'][^"']+["']/i.test(tag)
    ? tag.replace(/\bsrc=(["'])[^"']+\1/i, `src="${source}"`)
    : tag;
};

const preferWebpFallbacks = (html) => {
  const pictureAdjusted = html.replace(/<picture\b[\s\S]*?<\/picture>/gi, (picture) => {
    const webpSource = [...picture.matchAll(/<source\b[^>]*>/gi)]
      .map(([tag]) => tag)
      .find((tag) => attribute(tag, "type") === "image/webp");
    const fallback = largestSrcsetUrl(attribute(webpSource || "", "srcset") || "");
    return fallback
      ? picture.replace(/<img\b[^>]*>/i, (tag) => replaceImageSource(tag, fallback))
      : picture;
  });

  return pictureAdjusted.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcset = attribute(tag, "srcset");
    if (!srcset?.includes(".webp")) return tag;
    return replaceImageSource(tag, largestSrcsetUrl(srcset));
  });
};

// Source pages keep preview-friendly social tags. The deployment build removes
// them and injects one canonical, environment-aware SEO block.
const stripExistingSeo = (html) => html
  .replace(/\n\s*<link\s+rel=["']canonical["'][^>]*>/gi, "")
  .replace(/\n\s*<meta\s+(?:name=["'](?:robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi, "")
  .replace(/\n\s*<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");

const stamp = new Date().toISOString();
for (const page of PAGE_FILES) {
  const source = await readFile(resolve(root, page), "utf8");
  if (!source.includes("<!-- SEO_HEAD -->")) throw new Error(`Missing SEO_HEAD marker in ${page}`);
  const output = preferWebpFallbacks(stripExistingSeo(source))
    .replace("{{BUILD_TIME}}", stamp)
    .replace("<!-- SEO_HEAD -->", renderSeoHead(page, source));
  await writeFile(resolve(dist, page), output);
}

await writeFile(resolve(dist, "robots.txt"), renderRobots());
await writeFile(resolve(dist, "sitemap.xml"), renderSitemap());

const localAssetPattern = /\.{1,2}\/assets\/[^\s"'()<>,`]+/g;
const normalizeAssetPath = (reference) => reference
  .replace(/[?#].*$/, "")
  .replace(/^(?:\.\.\/|\.\/)+/, "");

const collectAssetReferences = (content) => [...content.matchAll(localAssetPattern)]
  .map(([reference]) => normalizeAssetPath(reference))
  .filter((reference) => reference.startsWith("assets/") && !reference.endsWith("/") && !reference.includes("{"));

const exactAssets = new Set([SEO_IMAGE_PATH.replace(/^\//, "")]);
for (const page of PAGE_FILES) {
  const html = await readFile(resolve(dist, page), "utf8");
  collectAssetReferences(html).forEach((asset) => exactAssets.add(asset));
}

for (const cssFile of ["styles.css", "implant-scenes.css", "general.css", "whitening.css", "location.css"]) {
  const css = await readFile(resolve(dist, "src", cssFile), "utf8");
  collectAssetReferences(css).forEach((asset) => exactAssets.add(asset));
}

const webpFiles = await readdir(resolve(assetRoot, "images/webp"));
const responsiveAssets = new Set();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const jsFile of ["main.js", "implant-scenes.js", "general.js", "whitening.js", "location.js"]) {
  const js = await readFile(resolve(dist, "src", jsFile), "utf8");
  for (const asset of collectAssetReferences(js)) {
    if (/\.(?:png|jpe?g)$/i.test(asset)) {
      const stem = basename(asset).replace(/\.[^.]+$/, "");
      const variantPattern = new RegExp(`^${escapeRegExp(stem)}-\\d+\\.webp$`);
      const variants = webpFiles.filter((file) => variantPattern.test(file));
      if (variants.length) {
        variants.forEach((file) => responsiveAssets.add(`assets/images/webp/${file}`));
        continue;
      }
    }
    exactAssets.add(asset);
  }
}

const walkFiles = async (directory, relativeBase) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    const relative = `${relativeBase}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walkFiles(absolute, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
};

// Every frame is requested by the sequence player even though the HTML contains
// only a {frame} template and the first frame URL.
const sequenceAssets = await walkFiles(
  resolve(assetRoot, "images/implant-digital-sequence"),
  "assets/images/implant-digital-sequence",
);

const copiedAssets = [...new Set([...exactAssets, ...responsiveAssets, ...sequenceAssets])].sort();
for (const asset of copiedAssets) {
  const source = resolve(root, asset);
  const target = resolve(dist, asset);
  const sourceStats = await stat(source).catch(() => null);
  if (!sourceStats?.isFile()) throw new Error(`Referenced asset is missing: ${asset}`);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

// Validate all statically addressable deployment references after the allowlist
// copy. JS data paths are intentionally converted to responsive WebP at runtime.
for (const page of PAGE_FILES) {
  const html = await readFile(resolve(dist, page), "utf8");
  for (const asset of collectAssetReferences(html)) await stat(resolve(dist, asset));
}
for (const cssFile of ["styles.css", "implant-scenes.css", "general.css", "whitening.css", "location.css"]) {
  const css = await readFile(resolve(dist, "src", cssFile), "utf8");
  for (const asset of collectAssetReferences(css)) await stat(resolve(dist, asset));
}

const manifest = {
  generatedAt: stamp,
  siteUrl: SITE_URL,
  assetCount: copiedAssets.length,
  assets: copiedAssets,
};
await writeFile(resolve(dist, "asset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const directoryBytes = async (directory) => {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    bytes += entry.isDirectory() ? await directoryBytes(path) : (await stat(path)).size;
  }
  return bytes;
};

const distMegabytes = (await directoryBytes(dist) / 1024 / 1024).toFixed(2);
console.log(`SSG build complete: ${dist}`);
console.log(`SEO origin: ${SITE_URL}`);
console.log(`Allowlisted assets: ${copiedAssets.length} files / dist: ${distMegabytes} MB`);
