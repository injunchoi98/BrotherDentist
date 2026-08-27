import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cssPath = resolve(root, "src/styles.css");
const css = await readFile(cssPath, "utf8");
const errors = [];

const definitions = new Map();
for (const match of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  definitions.set(match[1], match[2].trim());
}

const fixedSizeNames = [...definitions.keys()].filter((name) => /^type-(?:t\d+|e\d+)-size$/.test(name));
const fixedPairNames = fixedSizeNames.map((name) => name.replace(/-size$/, ""));
if (fixedPairNames.length !== 20) {
  errors.push(`고정 타입 쌍은 정확히 20개여야 합니다. 현재 ${fixedPairNames.length}개입니다.`);
}

for (const pair of fixedPairNames) {
  if (!definitions.has(`${pair}-line`)) errors.push(`${pair}에 대응하는 line-height 토큰이 없습니다.`);
}

const orphanFixedLines = [...definitions.keys()].filter(
  (name) => /^type-(?:t\d+|e\d+)-line$/.test(name) && !definitions.has(name.replace(/-line$/, "-size")),
);
for (const name of orphanFixedLines) errors.push(`${name}에 대응하는 size 토큰이 없습니다.`);

const fluidSizeNames = [...definitions.keys()].filter((name) => /^fluid-[\w-]+-size$/.test(name));
const fluidPairNames = fluidSizeNames.map((name) => name.replace(/-size$/, ""));
if (fluidPairNames.length !== 15) {
  errors.push(`유동 역할 타입 쌍은 정확히 15개여야 합니다. 현재 ${fluidPairNames.length}개입니다.`);
}

const mixedFluidPattern = /^clamp\([^,]+,\s*calc\([^)]*rem\s*\+\s*[^)]*vw\),\s*[^)]+\)$/;
for (const pair of fluidPairNames) {
  const sizeName = `${pair}-size`;
  const lineName = `${pair}-line`;
  const sizeValue = definitions.get(sizeName);
  const lineValue = definitions.get(lineName);
  if (!lineValue) {
    errors.push(`${pair}에 대응하는 line-height 토큰이 없습니다.`);
    continue;
  }
  if (!mixedFluidPattern.test(sizeValue)) errors.push(`${sizeName}은 clamp(rem, calc(rem + vw), rem) 형식이어야 합니다.`);
  if (!mixedFluidPattern.test(lineValue)) errors.push(`${lineName}은 clamp(rem, calc(rem + vw), rem) 형식이어야 합니다.`);

  const bounds = [...sizeValue.matchAll(/(-?\d*\.?\d+)rem/g)].map((match) => Number(match[1]));
  const min = bounds[0];
  const max = bounds.at(-1);
  if (min > 0 && max / min > 2.5) {
    errors.push(`${sizeName}의 최대/최소 비율 ${Number((max / min).toFixed(2))}은 2.5를 넘습니다.`);
  }

  const usageCount = [...css.matchAll(new RegExp(`var\\(--${sizeName}\\)`, "g"))].length;
  if (usageCount === 0) errors.push(`${sizeName}이 실제 스타일에서 사용되지 않습니다.`);
}

const typographyBlocks = new Map();
for (const propertyMatch of css.matchAll(/(?:font-size|line-height)\s*:/g)) {
  const open = css.lastIndexOf("{", propertyMatch.index);
  const close = css.indexOf("}", propertyMatch.index);
  if (open < 0 || close < 0) continue;
  typographyBlocks.set(open, css.slice(open + 1, close));
}

for (const [open, body] of typographyBlocks) {
  const previousClose = css.lastIndexOf("}", open);
  const previousOpen = css.lastIndexOf("{", open - 1);
  const selector = css.slice(Math.max(previousClose, previousOpen) + 1, open).trim().replace(/\s+/g, " ");
  const size = body.match(/font-size\s*:\s*([^;]+);/)?.[1].trim();
  const line = body.match(/line-height\s*:\s*([^;]+);/)?.[1].trim();

  if (!size && line) {
    errors.push(`${selector}: line-height를 지정할 때 같은 규칙에서 font-size도 짝으로 지정해야 합니다.`);
    continue;
  }
  if (!size) continue;
  if (!line) {
    errors.push(`${selector}: font-size를 지정할 때 같은 규칙에서 line-height도 짝으로 지정해야 합니다.`);
    continue;
  }
  if (size === "inherit" || line === "inherit") {
    if (size !== "inherit" || line !== "inherit") errors.push(`${selector}: 상속할 때 size와 line-height를 함께 상속해야 합니다.`);
    continue;
  }

  const sizePair = size.match(/^var\(--((?:type|fluid)-[\w-]+)-size\)$/)?.[1];
  const linePair = line.match(/^var\(--((?:type|fluid)-[\w-]+)-line\)$/)?.[1];
  if (!sizePair) errors.push(`${selector}: font-size는 등록된 size 토큰만 사용해야 합니다. 현재 ${size}`);
  if (!linePair) errors.push(`${selector}: line-height는 등록된 line 토큰만 사용해야 합니다. 현재 ${line}`);
  if (sizePair && linePair && sizePair !== linePair) {
    errors.push(`${selector}: ${sizePair} size와 ${linePair} line이 서로 다른 쌍입니다.`);
  }
}

for (const match of css.matchAll(/font-weight\s*:\s*([^;]+);/g)) {
  const value = match[1].trim();
  if (!new Set(["400", "500", "700"]).has(value)) errors.push(`허용되지 않은 font-weight ${value}가 있습니다.`);
}

if (errors.length) {
  console.error("Typography contract failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Typography contract passed: fixed ${fixedPairNames.length} pairs, fluid ${fluidPairNames.length} role pairs.`);
