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
    implant: resolve(root, "src/implant-scenes.js")
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
    implant: resolve(root, "src/implant-scenes.css")
  },
  outdir: resolve(dist, "src"),
  bundle: true,
  external: ["../assets/*"],
  minify: false,
  target: ["es2020"]
});

const stamp = new Date().toISOString();
for (const page of ["index.html", "implant.html"]) {
  const source = await readFile(resolve(root, page), "utf8");
  await writeFile(resolve(dist, page), source.replace("{{BUILD_TIME}}", stamp));
}

console.log(`SSG build complete: ${dist}`);
