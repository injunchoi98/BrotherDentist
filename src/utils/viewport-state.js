const ROOT_FONT_SIZE_FALLBACK = 16;
const MOBILE_MAX_REM = 48;
const MEDIUM_MAX_REM = 64;

const subscribers = new Set();
const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");

let smallViewportProbe = null;
let currentState = null;
let resizeFrame = 0;
let forceNextNotification = false;
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
  const nextState = measureViewportState();
  const viewportChanged = !currentState
    || nextState.width !== currentState.width
    || Math.round(nextState.smallViewportHeight) !== Math.round(currentState.smallViewportHeight)
    || nextState.reducedMotion !== currentState.reducedMotion;

  if (!viewportChanged && !forceNextNotification) return;
  forceNextNotification = false;
  currentState = nextState;
  subscribers.forEach((subscriber) => subscriber(currentState));
};

const scheduleMeasurement = (force = false) => {
  forceNextNotification ||= force;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(notifySubscribers);
};

const handleResize = () => {
  // Measure on the next frame: during the resize event, 100svh may still expose
  // the previous frame's value. Chrome-only mobile resizes are filtered later
  // because their stable small-viewport dimensions do not actually change.
  scheduleMeasurement();
};

const startViewportState = () => {
  if (started) return;
  started = true;
  currentState = measureViewportState();
  addEventListener("resize", handleResize, { passive: true });
  reducedMotionQuery.addEventListener("change", () => scheduleMeasurement(true));
  document.fonts?.ready.then(() => scheduleMeasurement(true));
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
