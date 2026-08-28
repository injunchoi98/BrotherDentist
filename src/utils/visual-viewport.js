import { getSmallViewportHeight } from "./viewport-state.js";

/**
 * Keeps a pinned visual centered in the area that is actually visible on
 * mobile Safari. The pin itself still uses stable `svh`; only the artwork's
 * center and cover height follow the expanding/collapsing browser chrome.
 */
export function bindVisualViewportMetrics(element) {
  if (!element) return () => {};

  const visualViewport = window.visualViewport;
  let frame = 0;

  const update = () => {
    frame = 0;
    const stableHeight = getSmallViewportHeight();
    const visibleHeight = visualViewport?.height || innerHeight || stableHeight;
    const visibleTop = visualViewport?.offsetTop || 0;
    const centerOffset = visibleTop + (visibleHeight / 2) - (stableHeight / 2);

    element.style.setProperty("--pin-visible-height", `${visibleHeight.toFixed(2)}px`);
    element.style.setProperty("--pin-visible-center-offset", `${centerOffset.toFixed(2)}px`);
  };

  const scheduleUpdate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };

  update();
  addEventListener("resize", scheduleUpdate, { passive: true });
  visualViewport?.addEventListener("resize", scheduleUpdate, { passive: true });
  visualViewport?.addEventListener("scroll", scheduleUpdate, { passive: true });

  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("resize", scheduleUpdate);
    visualViewport?.removeEventListener("resize", scheduleUpdate);
    visualViewport?.removeEventListener("scroll", scheduleUpdate);
    element.style.removeProperty("--pin-visible-height");
    element.style.removeProperty("--pin-visible-center-offset");
  };
}
