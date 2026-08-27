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
  entryPoints: [resolve(root, "src/main.js")],
  outfile: resolve(dist, "src/main.js"),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2020"],
  sourcemap: true
});

await build({
  entryPoints: [resolve(root, "src/styles.css")],
  outfile: resolve(dist, "src/styles.css"),
  bundle: true,
  external: ["../assets/*"],
  minify: false,
  target: ["es2020"]
});

const source = await readFile(resolve(root, "index.html"), "utf8");
const stamp = new Date().toISOString();
await writeFile(resolve(dist, "index.html"), source.replace("{{BUILD_TIME}}", stamp));

console.log(`SSG build complete: ${dist}`);
