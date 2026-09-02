import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_FILES, PAGE_SEO, SEO_IMAGE_PATH, SITE_URL } from "./seo.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const count = (source, pattern) => [...source.matchAll(pattern)].length;

for (const filename of PAGE_FILES) {
  const html = await readFile(resolve(dist, filename), "utf8");
  const canonical = `${SITE_URL}${PAGE_SEO[filename].path}`;
  const expected = [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${SITE_URL}${SEO_IMAGE_PATH}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
  ];
  for (const token of expected) {
    if (!html.includes(token)) throw new Error(`${filename}: missing ${token}`);
  }
  if (count(html, /<link rel="canonical"/g) !== 1) throw new Error(`${filename}: canonical must appear once`);
  if (count(html, /<meta property="og:title"/g) !== 1) throw new Error(`${filename}: og:title must appear once`);
  if (count(html, /<script type="application\/ld\+json">/g) !== 1) throw new Error(`${filename}: JSON-LD must appear once`);
  if (html.includes("{{BUILD_TIME}}") || html.includes("<!-- SEO_HEAD -->")) {
    throw new Error(`${filename}: generated placeholders remain`);
  }

  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)?.[1];
  const schema = JSON.parse(jsonLd || "null");
  const types = schema?.["@graph"]?.flatMap((node) => Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]) || [];
  for (const type of ["Dentist", "Organization", "WebSite", "WebPage", "BreadcrumbList"]) {
    if (!types.includes(type)) throw new Error(`${filename}: JSON-LD is missing ${type}`);
  }
}

const robots = await readFile(resolve(dist, "robots.txt"), "utf8");
if (!robots.includes("User-agent: *\nAllow: /") || !robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
  throw new Error("robots.txt must allow crawling and expose the sitemap URL");
}

const sitemap = await readFile(resolve(dist, "sitemap.xml"), "utf8");
for (const { path } of Object.values(PAGE_SEO)) {
  if (!sitemap.includes(`<loc>${SITE_URL}${path}</loc>`)) throw new Error(`sitemap.xml is missing ${path}`);
}
if (count(sitemap, /<url>/g) !== PAGE_FILES.length) throw new Error("sitemap.xml URL count mismatch");

console.log(`SEO check passed: ${PAGE_FILES.length} pages, robots.txt, sitemap.xml`);
