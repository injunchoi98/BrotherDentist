import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard,
} from "../utils/pin-height-guard.js";

gsap.registerPlugin(ScrollTrigger);

const FRAME_DIGITS = 3;
const MAX_DECODED_FRAMES = 14;
const MAX_CANVAS_PIXELS = 2_400_000;
const FRAME_FETCH_CACHE = import.meta.env?.DEV ? "no-store" : "force-cache";
const STEP_START_FRAMES = [0, 18, 58, 72, 94];

const clampFrame = (frame, frameCount) => Math.max(0, Math.min(frameCount - 1, frame));

const getStepIndex = (frame) => {
  for (let index = STEP_START_FRAMES.length - 1; index >= 0; index -= 1) {
    if (frame >= STEP_START_FRAMES[index]) return index;
  }
  return 0;
};

const loadImageFromBlob = (blob) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Unable to decode implant sequence frame"));
  };
  image.src = objectUrl;
});

function createFrameStore({ frameCount, sourceTemplate, onFrameReady }) {
  const blobs = new Array(frameCount);
  const decodedFrames = new Map();
  const pendingFetches = new Map();
  const pendingDecodes = new Map();
  const abortController = new AbortController();
  let disposed = false;
  let preloadPromise = null;

  const getFrameUrl = (index) => sourceTemplate.replace(
    "{frame}",
    String(index + 1).padStart(FRAME_DIGITS, "0"),
  );

  const fetchFrame = (index) => {
    const safeIndex = clampFrame(index, frameCount);
    if (blobs[safeIndex]) return Promise.resolve(blobs[safeIndex]);
    if (pendingFetches.has(safeIndex)) return pendingFetches.get(safeIndex);

    const request = fetch(getFrameUrl(safeIndex), {
      cache: FRAME_FETCH_CACHE,
      signal: abortController.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Frame request failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!disposed) blobs[safeIndex] = blob;
        return blob;
      })
      .finally(() => pendingFetches.delete(safeIndex));

    pendingFetches.set(safeIndex, request);
    return request;
  };

  const pruneDecodedFrames = (centerIndex) => {
    if (decodedFrames.size <= MAX_DECODED_FRAMES) return;
    const keep = [...decodedFrames.keys()]
      .sort((left, right) => Math.abs(left - centerIndex) - Math.abs(right - centerIndex))
      .slice(0, MAX_DECODED_FRAMES);
    const keepSet = new Set(keep);

    decodedFrames.forEach((frame, index) => {
      if (keepSet.has(index)) return;
      frame.close?.();
      decodedFrames.delete(index);
    });
  };

  const decodeFrame = (index, centerIndex = index) => {
    const safeIndex = clampFrame(index, frameCount);
    if (decodedFrames.has(safeIndex)) return Promise.resolve(decodedFrames.get(safeIndex));
    if (pendingDecodes.has(safeIndex)) return pendingDecodes.get(safeIndex);

    const request = fetchFrame(safeIndex)
      .then(async (blob) => {
        if (typeof createImageBitmap === "function") {
          try {
            return await createImageBitmap(blob);
          } catch {
            return loadImageFromBlob(blob);
          }
        }
        return loadImageFromBlob(blob);
      })
      .then((frame) => {
        if (disposed) {
          frame.close?.();
          return null;
        }
        decodedFrames.set(safeIndex, frame);
        pruneDecodedFrames(centerIndex);
        onFrameReady?.(safeIndex);
        return frame;
      })
      .catch(() => null)
      .finally(() => pendingDecodes.delete(safeIndex));

    pendingDecodes.set(safeIndex, request);
    return request;
  };

  const getNearestFrame = (index) => {
    if (decodedFrames.has(index)) return decodedFrames.get(index);
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    decodedFrames.forEach((frame, decodedIndex) => {
      const distance = Math.abs(decodedIndex - index);
      if (distance < nearestDistance) {
        nearest = frame;
        nearestDistance = distance;
      }
    });
    return nearest;
  };

  const warmWindow = (centerIndex, direction = 1) => {
    const indexes = [centerIndex];
    for (let offset = 1; offset <= 5; offset += 1) {
      indexes.push(centerIndex + offset * direction);
    }
    for (let offset = 1; offset <= 3; offset += 1) {
      indexes.push(centerIndex - offset * direction);
    }
    indexes
      .map((index) => clampFrame(index, frameCount))
      .filter((index, position, values) => values.indexOf(index) === position)
      .forEach((index) => decodeFrame(index, centerIndex));
  };

  const preloadCompressedFrames = () => {
    if (preloadPromise) return preloadPromise;
    let nextIndex = 0;
    const workers = Array.from({ length: 4 }, async () => {
      while (!disposed && nextIndex < frameCount) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          await fetchFrame(index);
        } catch {
          // The poster remains visible if a frame cannot be fetched. A later
          // direct request may still recover from a transient cache failure.
        }
      }
    });
    preloadPromise = Promise.all(workers);
    return preloadPromise;
  };

  const dispose = () => {
    disposed = true;
    abortController.abort();
    decodedFrames.forEach((frame) => frame.close?.());
    decodedFrames.clear();
    pendingFetches.clear();
    pendingDecodes.clear();
  };

  return {
    decodeFrame,
    getNearestFrame,
    preloadCompressedFrames,
    warmWindow,
    dispose,
  };
}

export function initImplantDigitalSequence({ header } = {}) {
  const section = document.querySelector("[data-implant-digital]");
  const story = section?.querySelector("[data-implant-digital-story]");
  const sticky = story?.querySelector("[data-implant-digital-sticky]");
  const layout = story?.querySelector(".implant-digital-layout");
  const copy = story?.querySelector("[data-implant-digital-copy]");
  const stage = story?.querySelector("[data-implant-digital-stage]");
  const canvas = story?.querySelector("[data-implant-digital-canvas]");
  const steps = [...(story?.querySelectorAll("[data-implant-digital-step]") || [])];
  const status = story?.querySelector("[data-implant-digital-status]");
  const frameCount = Number.parseInt(story?.dataset.frameCount || "0", 10);
  const sourceTemplate = story?.dataset.frameSource;

  if (!section || !story || !sticky || !layout || !copy || !stage || !canvas || !steps.length || !frameCount || !sourceTemplate) {
    return () => {};
  }

  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return () => {};

  let desiredFrame = 0;
  let previousFrame = 0;
  let activeStep = -1;
  let renderFrame = 0;
  let sequenceEnabled = false;
  let nearViewport = false;
  let layoutMetrics = null;

  const drawFrame = (frame) => {
    if (!frame || !canvas.width || !canvas.height) return;
    const sourceWidth = frame.width || frame.naturalWidth;
    const sourceHeight = frame.height || frame.naturalHeight;
    if (!sourceWidth || !sourceHeight) return;

    const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(frame, x, y, width, height);
    story.toggleAttribute("data-sequence-ready", true);
    if (status?.textContent !== "3D 진단 시퀀스가 준비되었습니다.") {
      status.textContent = "3D 진단 시퀀스가 준비되었습니다.";
    }
  };

  const store = createFrameStore({
    frameCount,
    sourceTemplate,
    onFrameReady: () => scheduleRender(),
  });

  const renderDesiredFrame = () => {
    renderFrame = 0;
    if (!sequenceEnabled) return;
    drawFrame(store.getNearestFrame(desiredFrame));
  };

  function scheduleRender() {
    if (!renderFrame) renderFrame = requestAnimationFrame(renderDesiredFrame);
  }

  const resizeCanvas = () => {
    const widthCssPixels = stage.clientWidth;
    const heightCssPixels = stage.clientHeight;
    if (!widthCssPixels || !heightCssPixels) return;
    let pixelRatio = Math.min(devicePixelRatio || 1, 2);
    const requestedPixels = widthCssPixels * heightCssPixels * pixelRatio * pixelRatio;
    if (requestedPixels > MAX_CANVAS_PIXELS) {
      pixelRatio *= Math.sqrt(MAX_CANVAS_PIXELS / requestedPixels);
    }
    const width = Math.max(1, Math.round(widthCssPixels * pixelRatio));
    const height = Math.max(1, Math.round(heightCssPixels * pixelRatio));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    scheduleRender();
  };

  const measureLayout = () => {
    const styles = getComputedStyle(layout);
    const stageScale = Number.parseFloat(styles.getPropertyValue("--implant-digital-stage-scale")) || 1;
    const stageXPercent = Number.parseFloat(styles.getPropertyValue("--implant-digital-stage-x-percent")) || 0;
    const layoutHeight = layout.clientHeight;
    const topSafety = Math.max((header?.offsetHeight || 0) + 24, 32);

    layoutMetrics = {
      copyY: Math.max(topSafety, (layoutHeight - copy.offsetHeight) / 2),
      stageScale,
      stageXPercent,
    };
  };

  const applyLayout = () => {
    if (!sequenceEnabled || !layoutMetrics) return;
    const { copyY, stageScale, stageXPercent } = layoutMetrics;

    gsap.set(copy, {
      x: 0,
      y: copyY,
      force3D: true,
    });
    gsap.set(stage, {
      x: 0,
      xPercent: stageXPercent,
      y: 0,
      yPercent: -50,
      scale: stageScale,
      transformOrigin: "50% 50%",
      force3D: true,
    });
    story.dataset.layoutProgress = "0.000";
  };

  const refreshLayout = () => {
    resizeCanvas();
    measureLayout();
    applyLayout();
  };

  const setActiveStep = (index) => {
    if (index === activeStep) return;
    activeStep = index;
    story.dataset.sequenceStep = String(index + 1);
    steps.forEach((step, stepIndex) => {
      if (stepIndex === index) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
  };

  const updateFrame = (playhead) => {
    const nextFrame = clampFrame(Math.round(playhead.frame), frameCount);
    const direction = nextFrame >= previousFrame ? 1 : -1;
    previousFrame = nextFrame;
    desiredFrame = nextFrame;
    story.dataset.sequenceFrame = String(nextFrame + 1).padStart(FRAME_DIGITS, "0");
    setActiveStep(getStepIndex(nextFrame));
    // The visual remains in the right column for every frame; only the actual
    // rendered camera moves around the anatomy.
    applyLayout();
    store.warmWindow(nextFrame, direction);
    store.decodeFrame(nextFrame, nextFrame).then(scheduleRender);
    scheduleRender();
  };

  const nearObserver = new IntersectionObserver(([entry]) => {
    nearViewport = entry.isIntersecting;
    if (nearViewport && sequenceEnabled) store.preloadCompressedFrames();
  }, { rootMargin: "160% 0px" });
  nearObserver.observe(story);

  const headerSurfaceObserver = header
    ? new IntersectionObserver(([entry]) => {
      header.toggleAttribute("data-on-dark", entry.isIntersecting);
    }, { threshold: 0 })
    : null;
  headerSurfaceObserver?.observe(section);

  const resizeObserver = new ResizeObserver(refreshLayout);
  resizeObserver.observe(stage);
  resizeObserver.observe(layout);
  resizeObserver.observe(copy);
  refreshLayout();
  setActiveStep(0);

  const disposeGuard = createPinHeightGuard({
    section: story,
    allowMobile: true,
    minimumHeightRem: (viewportState) => {
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // Phones use the authored static cards. Widths from 40rem upward keep
      // the scroll sequence, including the 768px tablet breakpoint.
      if (viewportState.width < rootFontSize * 40) return 10_000;
      const mediaHeight = Math.min(story.clientWidth * (2 / 3), rootFontSize * 34);
      const copyHeight = Math.max(...steps.map((step) => step.offsetHeight));
      return calculatePinMinimumHeightRem({
        headerHeightPixels: header?.offsetHeight || 0,
        contentHeightPixels: Math.max(mediaHeight, copyHeight + rootFontSize * 10),
        topSafetyRem: 2.5,
        bottomSafetyRem: 2.5,
      });
    },
    onEnable: () => {
      sequenceEnabled = true;
      const playhead = { frame: 0 };
      setActiveStep(getStepIndex(desiredFrame));
      refreshLayout();
      store.warmWindow(desiredFrame, 1);
      if (nearViewport) store.preloadCompressedFrames();

      let tween;
      tween = gsap.to(playhead, {
        frame: frameCount - 1,
        ease: "none",
        onUpdate() {
          updateFrame(playhead);
        },
        scrollTrigger: {
          id: "implant-digital-sequence",
          trigger: story,
          start: "top top",
          end: "bottom bottom",
          scrub: .55,
          invalidateOnRefresh: true,
          onRefresh: refreshLayout,
        },
      });

      updateFrame(playhead);

      return () => {
        sequenceEnabled = false;
        tween.scrollTrigger?.kill();
        tween.kill();
        cancelAnimationFrame(renderFrame);
        renderFrame = 0;
      };
    },
    onDisable: () => {
      sequenceEnabled = false;
      story.removeAttribute("data-sequence-ready");
      delete story.dataset.sequenceFrame;
      delete story.dataset.layoutProgress;
      gsap.set([copy, stage], { clearProps: "transform" });
      setActiveStep(0);
    },
  });

  return () => {
    disposeGuard?.();
    nearObserver.disconnect();
    headerSurfaceObserver?.disconnect();
    header?.removeAttribute("data-on-dark");
    resizeObserver.disconnect();
    cancelAnimationFrame(renderFrame);
    store.dispose();
  };
}
