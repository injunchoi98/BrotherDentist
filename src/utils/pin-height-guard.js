import { getSmallViewportHeight } from "./viewport-state.js";

export { getSmallViewportHeight };

export function createPinHeightGuard({ section, onDisable }) {
  if (!section) return () => {};

  section.style.setProperty("--pin-fallback-min-height", "0rem");
  section.dataset.pinMinimumHeight = "0rem";
  section.setAttribute("data-pin-disabled", "");
  const disposeMode = onDisable?.();

  return () => {
    disposeMode?.();
  };
}
