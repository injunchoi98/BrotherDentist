const ROOT_FONT_SIZE_FALLBACK = 16;
const MOBILE_MAX_REM = 48;
const MEDIUM_MAX_REM = 64;
const KAKAO_USER_AGENT_PATTERN = /KAKAOTALK/i;
const KAKAO_STABLE_VIEWPORT_ATTRIBUTE = "data-kakao-in-app";
const KAKAO_STABLE_VIEWPORT_PROPERTY = "--kakao-stable-viewport-height";
const KAKAO_INITIAL_SETTLE_FRAMES = 24;

const subscribers = new Set();
const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");

let smallViewportProbe = null;
let currentState = null;
let resizeFrame = 0;
let forceNextNotification = false;
let started = false;
let kakaoStableViewportEnabled = false;
let kakaoStableViewportHeight = 0;
let kakaoStableViewportWidth = 0;
let kakaoSettleFrame = 0;
let kakaoSettleFramesRemaining = 0;
let kakaoResetFrame = 0;

const getRootFontSize = () => {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(rootFontSize) ? rootFontSize : ROOT_FONT_SIZE_FALLBACK;
};

const getViewportWidth = () => Math.round(document.documentElement.clientWidth || innerWidth);

const measureNativeSmallViewportHeight = () => {
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

const measureKakaoViewportCandidate = () => {
  const candidates = [
    measureNativeSmallViewportHeight(),
    document.documentElement.clientHeight,
    innerHeight,
    window.visualViewport?.height,
  ].filter((height) => Number.isFinite(height) && height > 0);

  return candidates.length ? Math.round(Math.min(...candidates)) : 0;
};

const measureSmallViewportHeight = () => (
  kakaoStableViewportEnabled && kakaoStableViewportHeight
    ? kakaoStableViewportHeight
    : measureNativeSmallViewportHeight()
);

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

const commitKakaoViewportHeight = (height, reset = false) => {
  if (!Number.isFinite(height) || height <= 0) return;
  const nextHeight = reset || !kakaoStableViewportHeight
    ? height
    : Math.min(kakaoStableViewportHeight, height);
  if (nextHeight === kakaoStableViewportHeight) return;

  kakaoStableViewportHeight = nextHeight;
  document.documentElement.style.setProperty(
    KAKAO_STABLE_VIEWPORT_PROPERTY,
    `${nextHeight}px`,
  );
  if (started) scheduleMeasurement(true);
};

const sampleKakaoViewportHeight = () => {
  kakaoSettleFrame = 0;
  if (!kakaoSettleFramesRemaining) return;

  // WKWebView safe-area and toolbar insets can arrive after the first layout.
  // During this short opening window only accept smaller, safer candidates.
  kakaoSettleFramesRemaining -= 1;
  commitKakaoViewportHeight(measureKakaoViewportCandidate());
  if (kakaoSettleFramesRemaining) {
    kakaoSettleFrame = requestAnimationFrame(sampleKakaoViewportHeight);
  }
};

const settleKakaoViewportHeight = (reset = false) => {
  cancelAnimationFrame(kakaoSettleFrame);
  kakaoSettleFrame = 0;
  kakaoSettleFramesRemaining = KAKAO_INITIAL_SETTLE_FRAMES;
  if (reset) commitKakaoViewportHeight(measureKakaoViewportCandidate(), true);
  sampleKakaoViewportHeight();
};

const resetKakaoViewportAfterLayout = () => {
  cancelAnimationFrame(kakaoResetFrame);
  cancelAnimationFrame(kakaoSettleFrame);
  kakaoSettleFramesRemaining = 0;

  let framesUntilReset = 2;
  const waitForLayout = () => {
    if (framesUntilReset > 0) {
      framesUntilReset -= 1;
      kakaoResetFrame = requestAnimationFrame(waitForLayout);
      return;
    }

    kakaoResetFrame = 0;
    settleKakaoViewportHeight(true);
  };
  kakaoResetFrame = requestAnimationFrame(waitForLayout);
};

const syncKakaoViewportWidth = () => {
  if (!kakaoStableViewportEnabled) return;
  const nextWidth = getViewportWidth();
  if (nextWidth === kakaoStableViewportWidth) return;

  // Height-only resize events are the moving Kakao toolbar and intentionally
  // do nothing here. A width change means rotation or a real layout change.
  kakaoStableViewportWidth = nextWidth;
  resetKakaoViewportAfterLayout();
};

const handleResize = () => {
  // Measure on the next frame: during the resize event, 100svh may still expose
  // the previous frame's value. Chrome-only mobile resizes are filtered later
  // because their stable small-viewport dimensions do not actually change.
  syncKakaoViewportWidth();
  scheduleMeasurement();
};

export const initKakaoStableViewportHeight = () => {
  if (kakaoStableViewportEnabled || !KAKAO_USER_AGENT_PATTERN.test(navigator.userAgent)) {
    return kakaoStableViewportEnabled;
  }

  kakaoStableViewportEnabled = true;
  kakaoStableViewportWidth = getViewportWidth();
  document.documentElement.setAttribute(KAKAO_STABLE_VIEWPORT_ATTRIBUTE, "");
  settleKakaoViewportHeight(true);

  const settleAfterPageLoad = () => {
    syncKakaoViewportWidth();
    settleKakaoViewportHeight();
  };
  if (document.readyState === "complete") settleAfterPageLoad();
  else addEventListener("load", settleAfterPageLoad, { once: true });
  addEventListener("pageshow", settleAfterPageLoad);

  return true;
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
