import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(root, "assets"), resolve(dist, "assets"), { recursive: true });
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });
await build({
  entryPoints: {
    main: resolve(root, "src/main.js"),
    "implant-scenes": resolve(root, "src/implant-scenes.js"),
    general: resolve(root, "src/general.js"),
    whitening: resolve(root, "src/whitening.js"),
    location: resolve(root, "src/location.js")
  },
  outdir: resolve(dist, "src"),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2020"],
  sourcemap: true
});

await build({
  entryPoints: {
    styles: resolve(root, "src/styles.css"),
    "implant-scenes": resolve(root, "src/implant-scenes.css"),
    general: resolve(root, "src/general.css"),
    whitening: resolve(root, "src/whitening.css"),
    location: resolve(root, "src/location.css")
  },
  outdir: resolve(dist, "src"),
  bundle: true,
  external: ["../assets/*"],
  minify: false,
  target: ["es2020"]
});

// The implant page loads /src/implant-scenes.js directly. Keep this guard next
// to the bundling step so an entry-name regression cannot silently ship the
// copied source module with browser-unresolvable bare `gsap` imports again.
const implantBundle = await readFile(resolve(dist, "src/implant-scenes.js"), "utf8");
if (/\bfrom\s*["']gsap(?:\/ScrollTrigger)?["']/.test(implantBundle)) {
  throw new Error("implant-scenes.js must be the bundled browser entry");
}

const generalBundle = await readFile(resolve(dist, "src/general.js"), "utf8");
if (/\bfrom\s*["']gsap(?:\/ScrollTrigger)?["']/.test(generalBundle)) {
  throw new Error("general.js must be the bundled browser entry");
}

const whiteningBundle = await readFile(resolve(dist, "src/whitening.js"), "utf8");
if (/\bfrom\s*["']gsap(?:\/ScrollTrigger)?["']/.test(whiteningBundle)) {
  throw new Error("whitening.js must be the bundled browser entry");
}

const locationBundle = await readFile(resolve(dist, "src/location.js"), "utf8");
if (/\bfrom\s*["']gsap(?:\/ScrollTrigger)?["']/.test(locationBundle)) {
  throw new Error("location.js must be the bundled browser entry");
}

const stamp = new Date().toISOString();
for (const page of ["index.html", "implant.html", "general.html", "whitening.html", "location.html"]) {
  const source = await readFile(resolve(root, page), "utf8");
  await writeFile(resolve(dist, page), source.replace("{{BUILD_TIME}}", stamp));
}

console.log(`SSG build complete: ${dist}`);
