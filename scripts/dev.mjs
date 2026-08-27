import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "./build.mjs";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png" };

createServer(async (request, response) => {
  try {
    const path = resolve(root, `.${decodeURI(request.url?.split("?")[0] || "/")}`);
    const target = (await stat(path)).isDirectory() ? resolve(path, "index.html") : path;
    response.writeHead(200, { "content-type": types[extname(target)] || "application/octet-stream" });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("http://127.0.0.1:4173"));
