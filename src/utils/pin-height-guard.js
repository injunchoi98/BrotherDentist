import { getSmallViewportHeight, subscribeViewportState } from "./viewport-state.js";

const ROOT_FONT_SIZE_FALLBACK = 16;

const getRootFontSize = () => {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(rootFontSize) ? rootFontSize : ROOT_FONT_SIZE_FALLBACK;
};

export { getSmallViewportHeight };

export function createPinHeightGuard({ section, minimumHeightRem, onEnable, onDisable }) {
  if (!section) return () => {};

  let enabled = null;
  let disposeActivePin = null;

  const sync = (viewportState) => {
    const requiredRem = minimumHeightRem(viewportState);
    const requiredPixels = requiredRem * getRootFontSize();
    const nextEnabled = viewportState.pinningAllowed
      && viewportState.smallViewportHeight >= requiredPixels;

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
