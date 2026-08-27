const ROOT_FONT_SIZE_FALLBACK = 16;
const MOBILE_MAX_REM = 48;
const MEDIUM_MAX_REM = 64;

const subscribers = new Set();
const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");

let smallViewportProbe = null;
let currentState = null;
let resizeFrame = 0;
let started = false;

const getRootFontSize = () => {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(rootFontSize) ? rootFontSize : ROOT_FONT_SIZE_FALLBACK;
};

const getViewportWidth = () => Math.round(document.documentElement.clientWidth || innerWidth);

const measureSmallViewportHeight = () => {
  if (!CSS.supports("height", "100svh")) return innerHeight;

  if (!smallViewportProbe?.isConnected) {
    smallViewportProbe = document.createElement("div");
    smallViewportProbe.setAttribute("aria-hidden", "true");
    Object.assign(smallViewportProbe.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0",
      height: "100svh",
      overflow: "hidden",
      visibility: "hidden",
      pointerEvents: "none",
      contain: "strict"
    });
    document.documentElement.append(smallViewportProbe);
  }

  return smallViewportProbe.getBoundingClientRect().height || innerHeight;
};

const measureViewportState = () => {
  const width = getViewportWidth();
  const rootFontSize = getRootFontSize();
  const isMobile = width <= MOBILE_MAX_REM * rootFontSize;
  const layout = isMobile
    ? "mobile"
    : width <= MEDIUM_MAX_REM * rootFontSize
      ? "medium"
      : "desktop";

  return Object.freeze({
    width,
    smallViewportHeight: measureSmallViewportHeight(),
    isMobile,
    layout,
    reducedMotion: reducedMotionQuery.matches,
    pinningAllowed: !isMobile && !reducedMotionQuery.matches
  });
};

const notifySubscribers = () => {
  currentState = measureViewportState();
  subscribers.forEach((subscriber) => subscriber(currentState));
};

const scheduleMeasurement = () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(notifySubscribers);
};

const handleResize = () => {
  const nextWidth = getViewportWidth();
  const widthChanged = Math.abs(nextWidth - (currentState?.width ?? nextWidth)) > 1;

  // Mobile Safari fires resize while its browser chrome expands and collapses.
  // Pinning is disabled at this width, so keep the stable svh snapshot until
  // an actual width/orientation change occurs.
  if (currentState?.isMobile && !widthChanged) return;

  scheduleMeasurement();
};

const startViewportState = () => {
  if (started) return;
  started = true;
  currentState = measureViewportState();
  addEventListener("resize", handleResize, { passive: true });
  reducedMotionQuery.addEventListener("change", scheduleMeasurement);
  document.fonts?.ready.then(scheduleMeasurement);
};

export const getViewportState = () => {
  startViewportState();
  return currentState;
};

export const getSmallViewportHeight = () => getViewportState().smallViewportHeight;

export const subscribeViewportState = (subscriber) => {
  startViewportState();
  subscribers.add(subscriber);
  subscriber(currentState);
  return () => subscribers.delete(subscriber);
};
