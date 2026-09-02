import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(currentDir, "../..");
const imageDir = path.join(projectDir, "assets/images");
const width = 1200;
const height = 630;

const fontStack = "Apple SD Gothic Neo, Noto Sans CJK KR, sans-serif";

const concepts = [
  {
    base: "og-fresh-base-01.png",
    output: "og-365-seoul-gamdong-fresh-01.png",
    overlay: `
      <text x="72" y="220" fill="#1463d8" font-size="28" font-weight="700">감동을 드리는 치과</text>
      <text x="68" y="315" fill="#15191f" font-size="76" font-weight="700" letter-spacing="-4">365서울</text>
      <text x="68" y="398" fill="#15191f" font-size="76" font-weight="700" letter-spacing="-4">감동치과</text>
      <rect x="72" y="438" width="72" height="8" rx="4" fill="#1463d8" />
    `,
  },
  {
    base: "og-fresh-base-02.png",
    output: "og-365-seoul-gamdong-fresh-02.png",
    overlay: `
      <text x="700" y="230" fill="#1463d8" font-size="27" font-weight="700">감동을 드리는 치과</text>
      <text x="696" y="328" fill="#11151b" font-size="72" font-weight="700" letter-spacing="-4">365서울</text>
      <text x="696" y="408" fill="#11151b" font-size="72" font-weight="700" letter-spacing="-4">감동치과</text>
      <circle cx="1110" cy="484" r="10" fill="#1463d8" />
    `,
  },
  {
    base: "og-fresh-base-03.png",
    output: "og-365-seoul-gamdong-fresh-03.png",
    overlay: `
      <text x="720" y="230" fill="#48a1ff" font-size="27" font-weight="700">감동을 드리는 치과</text>
      <text x="714" y="330" fill="#ffffff" font-size="72" font-weight="700" letter-spacing="-4">365서울</text>
      <text x="714" y="410" fill="#ffffff" font-size="72" font-weight="700" letter-spacing="-4">감동치과</text>
      <path d="M718 458 H1092" stroke="#48a1ff" stroke-width="3" />
    `,
  },
  {
    base: "og-fresh-base-04.png",
    output: "og-365-seoul-gamdong-fresh-04.png",
    overlay: `
      <text x="600" y="267" text-anchor="middle" fill="#1769d2" font-size="27" font-weight="700">감동을 드리는 치과</text>
      <text x="600" y="350" text-anchor="middle" fill="#122c4c" font-size="82" font-weight="700" letter-spacing="-4">365서울감동치과</text>
      <path d="M430 415 C500 447 700 447 770 415" fill="none" stroke="#1769d2" stroke-width="9" stroke-linecap="round" />
    `,
  },
  {
    base: "og-fresh-base-05.png",
    output: "og-365-seoul-gamdong-fresh-05.png",
    overlay: `
      <text x="72" y="82" fill="#121820" font-size="25" font-weight="700">감동을 드리는 치과</text>
      <text x="62" y="248" fill="#0a55ea" font-size="160" font-weight="700" letter-spacing="-10">365</text>
      <text x="72" y="330" fill="#121820" font-size="62" font-weight="700" letter-spacing="-4">서울감동치과</text>
      <rect x="72" y="378" width="244" height="3" fill="#121820" />
    `,
  },
];

for (const concept of concepts) {
  const textLayer = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <g font-family="${fontStack}">
        ${concept.overlay}
      </g>
    </svg>
  `);

  await sharp(path.join(imageDir, concept.base))
    .resize({ width, height, fit: "cover", position: "centre" })
    .composite([{ input: textLayer, left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(imageDir, concept.output));
}
