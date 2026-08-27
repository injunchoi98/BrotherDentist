const ROOT_FONT_SIZE_FALLBACK = 16;

const getRootFontSize = () => {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(rootFontSize) ? rootFontSize : ROOT_FONT_SIZE_FALLBACK;
};

export function createPinHeightGuard({ section, minimumHeightRem, onEnable, onDisable }) {
  if (!section) return () => {};

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let enabled = null;
  let disposeActivePin = null;
  let frame = 0;
  let disposed = false;

  const sync = () => {
    const requiredRem = minimumHeightRem();
    const requiredPixels = requiredRem * getRootFontSize();
    const nextEnabled = !reducedMotion.matches && innerHeight >= requiredPixels;

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

  const scheduleSync = () => {
    if (disposed) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  };

  sync();
  addEventListener("resize", scheduleSync, { passive: true });
  reducedMotion.addEventListener("change", scheduleSync);
  document.fonts?.ready.then(scheduleSync);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    removeEventListener("resize", scheduleSync);
    reducedMotion.removeEventListener("change", scheduleSync);
    disposeActivePin?.();
  };
}
