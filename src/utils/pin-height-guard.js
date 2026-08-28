import { getSmallViewportHeight, subscribeViewportState } from "./viewport-state.js";

const ROOT_FONT_SIZE_FALLBACK = 16;

const getRootFontSize = () => {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(rootFontSize) ? rootFontSize : ROOT_FONT_SIZE_FALLBACK;
};

export { getSmallViewportHeight };

export function calculatePinMinimumHeightRem({
  headerHeightPixels = 0,
  contentHeightPixels = 0,
  topSafetyRem = 0,
  bottomSafetyRem = 0
}) {
  const rootFontSize = getRootFontSize();
  const totalPixels = headerHeightPixels
    + contentHeightPixels
    + ((topSafetyRem + bottomSafetyRem) * rootFontSize);

  // Pin thresholds follow the shared 4px spacing grid so the debug value is
  // stable and can be checked at threshold -1px / threshold / threshold +1px.
  return (Math.ceil(totalPixels / 4) * 4) / rootFontSize;
}

export function createPinHeightGuard({
  section,
  minimumHeightRem,
  allowMobile = false,
  onEnable,
  onDisable
}) {
  if (!section) return () => {};

  let enabled = null;
  let disposeActivePin = null;

  const sync = (viewportState) => {
    const requiredRem = minimumHeightRem(viewportState);
    const requiredPixels = requiredRem * getRootFontSize();
    // Mobile pinning is a section-level decision. Text-led scenes can opt in,
    // while card-heavy sections keep the existing compact-layout fallback.
    const layoutAllowsPinning = viewportState.pinningAllowed
      || (allowMobile && viewportState.isMobile && !viewportState.reducedMotion);
    // svh may resolve fractionally, while the documented threshold uses whole
    // CSS pixels on the shared spacing grid.
    const availablePixels = Math.round(viewportState.smallViewportHeight);
    const nextEnabled = layoutAllowsPinning
      && availablePixels >= Math.round(requiredPixels);

    section.style.setProperty("--pin-fallback-min-height", `${requiredRem}rem`);
    section.dataset.pinMinimumHeight = `${requiredRem}rem`;
    section.toggleAttribute("data-pin-disabled", !nextEnabled);

    if (nextEnabled === enabled) return;
    disposeActivePin?.();
    disposeActivePin = null;
    enabled = nextEnabled;

    if (nextEnabled) disposeActivePin = onEnable?.() || null;
    else onDisable?.();
  };

  const unsubscribe = subscribeViewportState(sync);

  return () => {
    unsubscribe();
    disposeActivePin?.();
  };
}
