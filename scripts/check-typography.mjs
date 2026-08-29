import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const css = (await Promise.all([
  "src/styles.css",
  "src/implant-scenes.css",
].map((file) => readFile(resolve(root, file), "utf8")))).join("\n");
// Cloudflare checks out only this repository; validate the committed deployment
// snapshot instead of relying on the parent workspace's token file.
const tokenCss = await readFile(resolve(root, "src/design-system/tokens.css"), "utf8");
const errors = [];

const allowedRoles = [
  "landing-heading-1",
  "landing-heading-2",
  "landing-heading-3",
  "landing-heading-4",
  "landing-body-1",
  "landing-body-2",
  "landing-body-3",
  "landing-body-4",
  "landing-ui-control",
  "landing-ui-label",
  "landing-ui-meta",
];
const allowedRoleSet = new Set(allowedRoles);
const contentRoles = new Set([
  "landing-heading-1",
  "landing-heading-2",
  "landing-heading-3",
  "landing-heading-4",
  "landing-body-1",
  "landing-body-2",
  "landing-body-3",
  "landing-body-4",
]);

const definitions = new Map();
const definitionValues = new Map();
for (const match of tokenCss.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  const name = match[1];
  const value = match[2].trim().replace(/\s+/g, " ");
  definitions.set(name, value);
  definitionValues.set(name, [...(definitionValues.get(name) ?? []), value]);
}

const mixedFluidPattern = /^clamp\(\s*\d*\.?\d+rem\s*,\s*calc\([^)]*rem\s*\+\s*[^)]*vw\)\s*,\s*\d*\.?\d+rem\s*\)$/;
const fixedRemPattern = /^\d*\.?\d+rem$/;
const clampPartsPattern = /^clamp\(\s*(\d*\.?\d+)rem\s*,\s*calc\(\s*(\d*\.?\d+)rem\s*\+\s*(\d*\.?\d+)vw\s*\)\s*,\s*(\d*\.?\d+)rem\s*\)$/;

const readDeclarations = (source = "") => {
  const values = new Map();
  for (const match of source.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    values.set(match[1], match[2].trim().replace(/\s+/g, " "));
  }
  return values;
};

const baseBlock = tokenCss.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1];
const middleFluidBlock = tokenCss.match(/@media\s*\(min-width:\s*64rem\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\n\}/)?.[1];
const wideFluidBlock = tokenCss.match(/@media\s*\(min-width:\s*90rem\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\n\}/)?.[1];
const responsiveDeclarations = {
  base: readDeclarations(baseBlock),
  middle: readDeclarations(middleFluidBlock),
  wide: readDeclarations(wideFluidBlock),
};

const resolveResponsiveValue = (name, width) => {
  let value = responsiveDeclarations.base.get(name);
  if (width >= 1024) value = responsiveDeclarations.middle.get(name) ?? value;
  if (width >= 1440) value = responsiveDeclarations.wide.get(name) ?? value;
  return value;
};

const sizeToPixels = (value, width) => {
  const fixed = value?.match(/^(\d*\.?\d+)rem$/);
  if (fixed) return Number(fixed[1]) * 16;
  const clamp = value?.match(clampPartsPattern);
  if (!clamp) return Number.NaN;
  const [, minimum, intercept, viewportFactor, maximum] = clamp.map(Number);
  return Math.min(maximum * 16, Math.max(minimum * 16, intercept * 16 + viewportFactor * width / 100));
};

const referenceWidths = [360, 390, 768, 1024, 1440, 1920];
const responsiveReference = {
  "landing-heading-1": { sizes: [40, 40, 60, 60, 80, 92], lines: [1.28, 1.28, 1.2, 1.2, 1.2, 1.2] },
  "landing-heading-2": { sizes: [36, 36, 36, 48, 48, 64], lines: [1.28, 1.28, 1.28, 1.28, 1.28, 1.28] },
  "landing-heading-3": { sizes: [28, 28, 28, 32, 32, 40], lines: [1.4, 1.4, 1.4, 1.4, 1.4, 1.4] },
  "landing-heading-4": { sizes: [18, 18, 18, 18, 20, 24], lines: [1.48, 1.48, 1.48, 1.48, 1.48, 1.48] },
  "landing-body-1": { sizes: [18, 18, 18, 18, 20, 24], lines: [1.48, 1.48, 1.48, 1.48, 1.48, 1.48] },
  "landing-body-2": { sizes: [16, 16, 16, 16, 16, 18], lines: [1.6, 1.6, 1.6, 1.6, 1.6, 1.6] },
  "landing-body-3": { sizes: [16, 16, 16, 16, 16, 18], lines: [1.6, 1.6, 1.6, 1.6, 1.6, 1.6] },
  "landing-body-4": { sizes: [14, 14, 16, 16, 16, 18], lines: [1.6, 1.6, 1.6, 1.6, 1.6, 1.6] },
};

for (const role of allowedRoles) {
  const sizeName = `${role}-size`;
  const lineName = `${role}-line-height`;
  const sizeValue = definitions.get(sizeName);
  const lineValue = definitions.get(lineName);
  const sizeValues = definitionValues.get(sizeName) ?? [];

  if (!sizeValue) errors.push(`${sizeName} 토큰이 없습니다.`);
  if (!lineValue) errors.push(`${lineName} 토큰이 없습니다.`);
  if (!sizeValue) continue;

  for (const value of sizeValues) {
    const isSharedBodyThree = role === "landing-body-3"
      && value === "var(--landing-body-2-size)";
    const isAllowedContentValue = fixedRemPattern.test(value)
      || mixedFluidPattern.test(value)
      || isSharedBodyThree;
    if (contentRoles.has(role) && !isAllowedContentValue) {
      errors.push(`${sizeName}의 ${value} 값은 고정 rem 또는 clamp(rem, calc(rem + vw), rem) 형식이어야 합니다.`);
    }
    if (!contentRoles.has(role) && !fixedRemPattern.test(value)) {
      errors.push(`${sizeName}은 고정 rem 값이어야 합니다.`);
    }

    const bounds = [...value.matchAll(/(\d*\.?\d+)rem/g)].map((match) => Number(match[1]));
    if (bounds.length >= 2 && bounds[0] > 0 && bounds.at(-1) / bounds[0] > 2.5) {
      errors.push(`${sizeName}의 한 단계 내 최대/최소 비율은 2.5를 넘을 수 없습니다.`);
    }
  }
}

for (const [role, reference] of Object.entries(responsiveReference)) {
  referenceWidths.forEach((width, index) => {
    const sizeName = `${role}-size`;
    const lineName = `${role}-line-height`;
    const actualSize = sizeToPixels(resolveResponsiveValue(sizeName, width), width);
    const lineValue = resolveResponsiveValue(lineName, width);
    const lineRatio = Number(lineValue);
    const actualLinePixels = Number.isFinite(lineRatio)
      ? actualSize * lineRatio
      : sizeToPixels(lineValue, width);
    const expectedLinePixels = reference.sizes[index] * reference.lines[index];
    if (!Number.isFinite(actualSize) || Math.abs(actualSize - reference.sizes[index]) > 0.02) {
      errors.push(`${sizeName}의 ${width}px 계산값은 ${reference.sizes[index]}px이어야 합니다. 현재 ${actualSize}`);
    }
    if (!Number.isFinite(actualLinePixels) || Math.abs(actualLinePixels - expectedLinePixels) > 0.02) {
      errors.push(`${lineName}의 ${width}px 계산값은 ${expectedLinePixels}px이어야 합니다. 현재 ${actualLinePixels}`);
    }
  });
}

for (const boundary of [1024, 1440]) {
  for (const role of contentRoles) {
    const sizeName = `${role}-size`;
    const lineName = `${role}-line-height`;
    const samples = [boundary - 0.01, boundary, boundary + 0.01].map((width) => {
      const size = sizeToPixels(resolveResponsiveValue(sizeName, width), width);
      const lineValue = resolveResponsiveValue(lineName, width);
      const lineRatio = Number(lineValue);
      const line = Number.isFinite(lineRatio) ? size * lineRatio : sizeToPixels(lineValue, width);
      return { size, line };
    });
    const sizeSpread = Math.max(...samples.map(({ size }) => size)) - Math.min(...samples.map(({ size }) => size));
    const lineSpread = Math.max(...samples.map(({ line }) => line)) - Math.min(...samples.map(({ line }) => line));
    if (!Number.isFinite(sizeSpread) || sizeSpread > 0.02) {
      errors.push(`${sizeName}이 ${boundary}px 식 전환점에서 연속적이지 않습니다.`);
    }
    if (!Number.isFinite(lineSpread) || lineSpread > 0.03) {
      errors.push(`${lineName}이 ${boundary}px 식 전환점에서 연속적이지 않습니다.`);
    }
  }
}

if (/(?:--|var\(--)(?:type|fluid)-/.test(css)) {
  errors.push("페이지 CSS에서 원시 type-* 또는 섹션별 fluid-* 토큰을 사용할 수 없습니다.");
}

const typographyBlocks = new Map();
for (const propertyMatch of css.matchAll(/(?:font-size|line-height)\s*:/g)) {
  const open = css.lastIndexOf("{", propertyMatch.index);
  const close = css.indexOf("}", propertyMatch.index);
  if (open < 0 || close < 0) continue;
  typographyBlocks.set(open, css.slice(open + 1, close));
}

const selectorRoles = new Map();
const usedRoles = new Set();

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

  const sizeRole = size.match(/^var\(--(landing-(?:heading-[1-4]|body-[1-4]|ui-(?:control|label|meta)))-size\)$/)?.[1];
  const lineRole = line.match(/^var\(--(landing-(?:heading-[1-4]|body-[1-4]|ui-(?:control|label|meta)))-line-height\)$/)?.[1];
  if (!sizeRole || !allowedRoleSet.has(sizeRole)) errors.push(`${selector}: font-size는 공개 역할 토큰만 사용해야 합니다. 현재 ${size}`);
  if (!lineRole || !allowedRoleSet.has(lineRole)) errors.push(`${selector}: line-height는 공개 역할 토큰만 사용해야 합니다. 현재 ${line}`);
  if (sizeRole && lineRole && sizeRole !== lineRole) {
    errors.push(`${selector}: ${sizeRole} size와 ${lineRole} line-height가 서로 다른 역할입니다.`);
  }
  if (!sizeRole) continue;

  usedRoles.add(sizeRole);
  if (!selectorRoles.has(selector)) selectorRoles.set(selector, new Set());
  selectorRoles.get(selector).add(sizeRole);
}

for (const [selector, roles] of selectorRoles) {
  if (roles.size > 1) {
    errors.push(`${selector}: 반응형 구간에서 역할을 바꿀 수 없습니다. 현재 ${[...roles].join(", ")}`);
  }
}

const equivalentSelectorGroups = [
  [
    ".showcase-title-lock h3",
    ".showcase[data-pin-disabled] .showcase-static-title",
  ],
  [
    ".showcase-image-copy strong",
    ".showcase[data-pin-disabled] .showcase-static-final h3",
  ],
];

for (const selectors of equivalentSelectorGroups) {
  const roles = selectors.map((selector) => [...(selectorRoles.get(selector) ?? [])][0]);
  if (roles.some((role) => !role)) {
    errors.push(`${selectors.join(" / ")}: 같은 문구의 핀·폴백 역할을 모두 확인할 수 있어야 합니다.`);
    continue;
  }
  if (new Set(roles).size > 1) {
    errors.push(`${selectors.join(" / ")}: 같은 문구의 핀·폴백은 같은 역할이어야 합니다. 현재 ${roles.join(", ")}`);
  }
}

const allowedWeights = new Set([
  "var(--landing-font-weight-regular)",
  "var(--landing-font-weight-medium)",
  "var(--landing-font-weight-bold)",
]);
for (const match of css.matchAll(/font-weight\s*:\s*([^;]+);/g)) {
  const value = match[1].trim();
  if (!allowedWeights.has(value)) errors.push(`font-weight는 공개 weight 토큰만 사용해야 합니다. 현재 ${value}`);
}

for (const match of css.matchAll(/(?:^|[;{}])\s*font-family\s*:\s*([^;]+);/gm)) {
  const value = match[1].trim();
  if (value !== "var(--landing-font-family)") errors.push(`font-family는 --landing-font-family만 사용해야 합니다. 현재 ${value}`);
}

if (errors.length) {
  console.error("Typography contract failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Typography contract passed: ${allowedRoles.length} allowed roles, ${usedRoles.size} used on this page.`);
