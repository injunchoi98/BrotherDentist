import { getSmallViewportHeight, getViewportState } from "../utils/viewport-state.js";

const formatPixels = (value) => (
  Number.isFinite(value) ? `${value.toFixed(2)} px` : "지원 안 함"
);

const describeShiftSource = (source) => {
  const node = source?.node;
  if (!(node instanceof Element)) return "알 수 없는 요소";
  const identity = node.id
    ? `#${node.id}`
    : node.classList.length
      ? `.${[...node.classList].slice(0, 2).join(".")}`
      : node.tagName.toLowerCase();
  return identity;
};

export function initViewportDebug() {
  const root = document.querySelector("[data-viewport-debug-section]");
  if (!root || !document.documentElement.hasAttribute("data-viewport-debug")) return;

  const valueNodes = new Map(
    [...root.querySelectorAll("[data-viewport-value]")]
      .map((node) => [node.dataset.viewportValue, node]),
  );
  const probes = new Map(
    [...root.querySelectorAll("[data-viewport-probe]")]
      .map((node) => [node.dataset.viewportProbe, node]),
  );
  const eventLog = root.querySelector("[data-viewport-event-log]");
  const resetButton = root.querySelector("[data-viewport-reset]");
  const visualViewport = window.visualViewport;
  const events = [];
  const counts = new Map();
  let cumulativeLayoutShift = 0;
  let lastShiftSource = "없음";
  let lastHeightFingerprint = "";
  let pendingReason = "initial";
  let frame = 0;
  let scrollTimer = 0;

  const setValue = (key, value) => {
    const node = valueNodes.get(key);
    if (node && node.textContent !== String(value)) node.textContent = String(value);
  };

  const measureProbe = (name) => probes.get(name)?.getBoundingClientRect().height;

  const readSnapshot = () => {
    const state = getViewportState();
    const stableProperty = getComputedStyle(document.documentElement)
      .getPropertyValue("--kakao-stable-viewport-height")
      .trim();
    const unitHeights = {
      svh: measureProbe("svh"),
      vh: measureProbe("vh"),
      dvh: measureProbe("dvh"),
      lvh: measureProbe("lvh"),
    };

    return {
      width: document.documentElement.clientWidth,
      innerHeight: window.innerHeight,
      clientHeight: document.documentElement.clientHeight,
      outerHeight: window.outerHeight,
      visualHeight: visualViewport?.height,
      visualOffsetTop: visualViewport?.offsetTop,
      visualScale: visualViewport?.scale,
      screenHeight: window.screen.height,
      scrollY: window.scrollY,
      smallViewportHeight: getSmallViewportHeight(),
      stableProperty: stableProperty || "설정 안 됨",
      kakao: document.documentElement.hasAttribute("data-kakao-in-app"),
      scrollMode: document.documentElement.dataset.showcaseTouchMode || "초기화 전",
      layout: state.layout,
      reducedMotion: state.reducedMotion,
      unitHeights,
    };
  };

  const renderLog = () => {
    if (!eventLog) return;
    eventLog.replaceChildren(...events.map((event) => {
      const item = document.createElement("li");
      const time = document.createElement("time");
      const label = document.createElement("span");
      const details = document.createElement("code");
      time.textContent = event.time;
      label.textContent = event.reason;
      details.textContent = event.details;
      item.append(time, label, details);
      return item;
    }));
  };

  const appendEvent = (reason, snapshot) => {
    counts.set(reason, (counts.get(reason) || 0) + 1);
    const eventNumber = counts.get(reason);
    const visualHeight = Number.isFinite(snapshot.visualHeight)
      ? snapshot.visualHeight.toFixed(1)
      : "n/a";
    events.unshift({
      time: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
      reason: `${reason} #${eventNumber}`,
      details: `inner ${snapshot.innerHeight} · visual ${visualHeight} · svh ${snapshot.unitHeights.svh?.toFixed(1) ?? "n/a"} · y ${Math.round(snapshot.scrollY)}`,
    });
    events.splice(10);
  };

  const writeSnapshot = (snapshot, reason) => {
    setValue("css-svh", formatPixels(snapshot.unitHeights.svh));
    setValue("css-vh", formatPixels(snapshot.unitHeights.vh));
    setValue("css-dvh", formatPixels(snapshot.unitHeights.dvh));
    setValue("css-lvh", formatPixels(snapshot.unitHeights.lvh));
    setValue("inner-height", formatPixels(snapshot.innerHeight));
    setValue("client-height", formatPixels(snapshot.clientHeight));
    setValue("outer-height", formatPixels(snapshot.outerHeight));
    setValue("visual-height", formatPixels(snapshot.visualHeight));
    setValue("visual-offset", formatPixels(snapshot.visualOffsetTop));
    setValue("visual-scale", Number.isFinite(snapshot.visualScale) ? snapshot.visualScale.toFixed(3) : "지원 안 함");
    setValue("screen-height", formatPixels(snapshot.screenHeight));
    setValue("small-height", formatPixels(snapshot.smallViewportHeight));
    setValue("stable-height", snapshot.stableProperty);
    setValue("viewport-width", formatPixels(snapshot.width));
    setValue("scroll-y", formatPixels(snapshot.scrollY));
    setValue("kakao", snapshot.kakao ? "예" : "아니오");
    setValue("scroll-mode", snapshot.scrollMode);
    setValue("layout", snapshot.layout);
    setValue("reduced-motion", snapshot.reducedMotion ? "reduce" : "no-preference");
    setValue("cls", cumulativeLayoutShift.toFixed(5));
    setValue("last-shift", lastShiftSource);
    setValue("last-event", reason);
    renderLog();
  };

  const measure = () => {
    frame = 0;
    const reason = pendingReason;
    pendingReason = "update";
    const snapshot = readSnapshot();
    const fingerprint = [
      snapshot.innerHeight,
      snapshot.clientHeight,
      snapshot.visualHeight?.toFixed(2),
      snapshot.unitHeights.svh?.toFixed(2),
      snapshot.unitHeights.vh?.toFixed(2),
      snapshot.unitHeights.dvh?.toFixed(2),
    ].join("|");
    if (reason !== "scroll" || fingerprint !== lastHeightFingerprint) {
      appendEvent(reason, snapshot);
    }
    lastHeightFingerprint = fingerprint;
    writeSnapshot(snapshot, reason);
  };

  const scheduleMeasure = (reason) => {
    pendingReason = reason;
    if (!frame) frame = requestAnimationFrame(measure);
  };
  const handleScroll = () => {
    if (scrollTimer) return;
    scrollTimer = window.setTimeout(() => {
      scrollTimer = 0;
      scheduleMeasure("scroll");
    }, 100);
  };
  const handleVisibility = () => scheduleMeasure(`visibility:${document.visibilityState}`);

  addEventListener("resize", () => scheduleMeasure("window.resize"), { passive: true });
  addEventListener("orientationchange", () => scheduleMeasure("orientationchange"), { passive: true });
  addEventListener("pageshow", () => scheduleMeasure("pageshow"), { passive: true });
  addEventListener("scroll", handleScroll, { passive: true });
  visualViewport?.addEventListener("resize", () => scheduleMeasure("visualViewport.resize"), { passive: true });
  visualViewport?.addEventListener("scroll", () => scheduleMeasure("visualViewport.scroll"), { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);

  resetButton?.addEventListener("click", () => {
    cumulativeLayoutShift = 0;
    lastShiftSource = "없음";
    events.length = 0;
    counts.clear();
    scheduleMeasure("reset");
  });

  if ("PerformanceObserver" in window
    && PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.hadRecentInput) return;
        cumulativeLayoutShift += entry.value;
        lastShiftSource = entry.sources?.length
          ? entry.sources.map(describeShiftSource).join(", ")
          : "소스 미상";
      });
      scheduleMeasure("layout-shift");
    });
    observer.observe({ type: "layout-shift", buffered: true });
    addEventListener("pagehide", () => observer.disconnect(), { once: true });
  } else {
    setValue("cls", "지원 안 함");
    setValue("last-shift", "LayoutShift API 지원 안 함");
  }

  scheduleMeasure("initial");
}
