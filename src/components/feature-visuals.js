import { initInfiniteMarquee } from "../utils/infinite-marquee.js";

const QUALITY_TILE_STEP = 46;
const QUALITY_TILE_ROW_STEP = QUALITY_TILE_STEP * Math.sin(Math.PI / 3);
const QUALITY_TILE_RADIUS = QUALITY_TILE_STEP / 2;
const QUALITY_SPRITE_TILE_SIZE = 44;
const QUALITY_SPRITE_PIXEL_SIZE = QUALITY_SPRITE_TILE_SIZE * 2;
const QUALITY_COLUMNS = 15;
// An even row count lets the staggered hex grid wrap vertically without
// changing parity, so the desktop field can rotate forever without a seam.
const QUALITY_ROWS = 20;
const QUALITY_WORLD_WIDTH = QUALITY_COLUMNS * QUALITY_TILE_STEP;
const QUALITY_WORLD_HEIGHT = QUALITY_ROWS * QUALITY_TILE_ROW_STEP;
const QUALITY_AUTO_FRAME_INTERVAL = 1000 / 60;
const QUALITY_MOBILE_ROWS = [
  { offset: 0, direction: "left", speed: "normal" },
  { offset: 2, direction: "right", speed: "fast" },
  { offset: 4, direction: "left", speed: "fast" },
  { offset: 6, direction: "right", speed: "normal" }
];

function initQualityMobileMarquee(cloud) {
  const fallback = cloud.querySelector("[data-quality-logo-fallback]");
  const sourceSet = fallback?.querySelector("[data-quality-source-set]");
  const sourceTiles = sourceSet ? [...sourceSet.children] : [];
  if (!fallback || !sourceTiles.length || cloud.hasAttribute("data-quality-mobile-ready")) return;

  const rows = document.createElement("div");
  rows.className = "quality-logo-rows";
  rows.setAttribute("aria-hidden", "true");

  QUALITY_MOBILE_ROWS.forEach(({ offset, direction, speed }) => {
    const row = document.createElement("div");
    const track = document.createElement("div");
    row.className = "quality-logo-row";
    track.className = "quality-logo-track";

    // Rotate the same verified source set for every row so adjacent rows do
    // not form rigid columns. The originals remain untouched for desktop's
    // canvas renderer and for a useful no-JavaScript fallback.
    const orderedTiles = [
      ...sourceTiles.slice(offset),
      ...sourceTiles.slice(0, offset)
    ];
    // A single seven-logo set is only about 26rem wide. On compact layouts
    // near the 48rem breakpoint that is shorter than the visible row, so one
    // set plus one duplicate can reveal the track's end while it moves. Seed
    // each half with two identical cycles (about 54rem) before the marquee
    // utility duplicates it. Every supported mobile width is then covered by
    // a complete off-screen copy and the loop remains visually continuous.
    for (let cycle = 0; cycle < 2; cycle += 1) {
      orderedTiles.forEach((tile) => {
        const clone = tile.cloneNode(true);
        clone.querySelector("[data-quality-logo-source]")
          ?.removeAttribute("data-quality-logo-source");
        track.append(clone);
      });
    }

    row.append(track);
    rows.append(row);
    initInfiniteMarquee({ track, direction, speed, pauseOnHover: false });
  });

  fallback.append(rows);
  cloud.setAttribute("data-quality-mobile-ready", "");
}

function shuffleDeterministically(items) {
  const shuffled = [...items];
  let seed = 7919;
  const random = () => {
    seed = (16807 * seed) % 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function greatestCommonDivisor(left, right) {
  return right === 0 ? left : greatestCommonDivisor(right, left % right);
}

function distributeLogoIndexes(length, total) {
  if (!length) return Array(total).fill(0);

  const indexes = shuffleDeterministically(Array.from({ length }, (_, index) => index));
  let stride = Math.min(QUALITY_ROWS, Math.max(1, length - 1));
  while (stride > 1 && greatestCommonDivisor(stride, length) !== 1) stride -= 1;

  const distribution = [];
  let cursor = 0;
  for (let index = 0; index < total; index += 1) {
    distribution.push(indexes[cursor]);
    cursor = (cursor + stride) % length;
  }
  return distribution;
}

function waitForImage(image) {
  return new Promise((resolve) => {
    if (image.complete && image.naturalWidth) {
      resolve(image);
      return;
    }
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => resolve(null), { once: true });
    image.loading = "eager";
  });
}

function drawContainedImage(context, image, x, y, width, height) {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (!imageWidth || !imageHeight) return;

  const scale = Math.min(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  context.drawImage(
    image,
    x + ((width - drawWidth) / 2),
    y + ((height - drawHeight) / 2),
    drawWidth,
    drawHeight,
  );
}

function buildLogoSprite(images) {
  const pixelRatio = 2;
  const tileSize = QUALITY_SPRITE_TILE_SIZE;
  const sprite = document.createElement("canvas");
  sprite.width = tileSize * pixelRatio * images.length;
  sprite.height = tileSize * pixelRatio;

  const context = sprite.getContext("2d");
  if (!context) return null;

  context.scale(pixelRatio, pixelRatio);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  images.forEach((image, index) => {
    const x = index * tileSize;
    context.beginPath();
    context.roundRect(x, 0, tileSize, tileSize, 12);
    context.fillStyle = "rgba(255, 255, 255, .92)";
    context.fill();
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const emblem = imageWidth / imageHeight < 1.45;
    const needsDarkInk = /(?:dio|straumann|dentsply-sirona)\.(?:png|svg)(?:\?|$)/i.test(image.src);
    context.save();
    if (needsDarkInk) context.filter = "brightness(0) opacity(.72)";
    if (emblem) drawContainedImage(context, image, x + 9, 9, 26, 26);
    else drawContainedImage(context, image, x + 2, 8, 40, 28);
    context.restore();
  });

  return sprite;
}

function initQualityLogoCloud(cloud, reducedMotion) {
  initQualityMobileMarquee(cloud);
  const canvas = cloud.querySelector("[data-quality-logo-canvas]");
  const sourceElements = [...cloud.querySelectorAll("[data-quality-logo-source]")];
  if (!canvas || !sourceElements.length) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const positions = [];
  for (let row = 0; row < QUALITY_ROWS; row += 1) {
    for (let column = 0; column < QUALITY_COLUMNS; column += 1) {
      positions.push({
        x: (column * QUALITY_TILE_STEP) + (row % 2 === 1 ? QUALITY_TILE_RADIUS : 0),
        y: row * QUALITY_TILE_ROW_STEP,
      });
    }
  }

  const state = {
    centerX: 0,
    centerY: 0,
    focusX: 0,
    focusY: 0,
    targetFocusX: 0,
    targetFocusY: 0,
    worldOffsetX: 0,
    worldOffsetY: 0,
    velocityX: 0,
    velocityY: 0,
    targetVelocityX: 0,
    targetVelocityY: 0,
    width: 0,
    height: 0,
    pixelRatio: 1,
  };

  let sprite = null;
  let distribution = [];
  let animationFrame = 0;
  let lastRenderedAt = 0;
  let viewportObserver = null;
  let visible = !("IntersectionObserver" in window);
  let pointerInside = false;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  // Match the CSS compact breakpoint exactly so a 48rem viewport never paints
  // the hidden desktop canvas behind the visible four-row marquee.
  const mobileLayout = matchMedia("(max-width: 48rem)");
  const getMode = () => {
    if (reducedMotion.matches || mobileLayout.matches) return "static";
    if (finePointer.matches) return pointerInside ? "globe" : "rest";
    return "auto";
  };

  const wrapCentered = (value, size) => {
    const wrapped = ((value + (size / 2)) % size + size) % size;
    return wrapped - (size / 2);
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (!bounds.width || !bounds.height) return false;
    if (state.width === bounds.width && state.height === bounds.height && state.pixelRatio === pixelRatio) return false;

    state.width = bounds.width;
    state.height = bounds.height;
    state.pixelRatio = pixelRatio;
    state.centerX = bounds.width / 2;
    state.centerY = (bounds.height / 2) + 32;
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.height * pixelRatio);
    return true;
  };

  const render = () => {
    if (!sprite || !state.width || !state.height) return;

    context.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0);
    context.clearRect(0, 0, state.width, state.height);

    positions.forEach((position, index) => {
      // Wrap the even-row hex field around an invisible cylinder in both axes.
      // Tiles crossing an outer edge re-enter well outside the clipped card,
      // which makes a held hover feel like a continuously rotating globe.
      const worldX = wrapCentered(
        position.x - (QUALITY_WORLD_WIDTH / 2) - state.worldOffsetX,
        QUALITY_WORLD_WIDTH
      );
      const worldY = wrapCentered(
        position.y - (QUALITY_WORLD_HEIGHT / 2) - state.worldOffsetY,
        QUALITY_WORLD_HEIGHT
      );
      const offsetX = worldX - state.focusX;
      const offsetY = worldY - state.focusY;

      const radialStrength = Math.exp(-((offsetX * offsetX) + (offsetY * offsetY)) / 33800);
      const scale = .18 + (1.17 * radialStrength);
      const perspective = 1 + ((scale - .18) * .5);
      const focusX = state.focusX;
      const focusY = state.focusY;
      const x = state.centerX + focusX + (offsetX * perspective);
      const y = state.centerY + focusY + (offsetY * perspective);
      const size = QUALITY_SPRITE_TILE_SIZE * scale;
      const halfSize = size / 2;
      if (x + halfSize < 0 || x - halfSize > state.width || y + halfSize < 0 || y - halfSize > state.height) return;

      context.globalAlpha = .68 + (.32 * radialStrength);
      context.drawImage(
        sprite,
        distribution[index] * QUALITY_SPRITE_PIXEL_SIZE,
        0,
        QUALITY_SPRITE_PIXEL_SIZE,
        QUALITY_SPRITE_PIXEL_SIZE,
        x - halfSize,
        y - halfSize,
        size,
        size,
      );
    });
    context.globalAlpha = 1;
  };

  const stopAnimation = () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  const tick = (time) => {
    animationFrame = 0;
    if (!sprite || !visible || document.hidden || reducedMotion.matches) return;

    const mode = getMode();
    if (time - lastRenderedAt < QUALITY_AUTO_FRAME_INTERVAL) {
      animationFrame = requestAnimationFrame(tick);
      return;
    }

    const elapsedSeconds = lastRenderedAt
      ? Math.min((time - lastRenderedAt) / 1000, .05)
      : 0;
    lastRenderedAt = time;

    if (mode === "auto") {
      // Touch layouts above the four-row breakpoint have no hover state, so
      // keep a quiet default rotation while the card is visible.
      state.targetVelocityX = 14;
      state.targetVelocityY = 5;
    } else if (mode !== "globe") {
      state.targetVelocityX = 0;
      state.targetVelocityY = 0;
    }

    const velocityEasing = mode === "globe" || mode === "auto" ? .1 : .075;
    state.velocityX += (state.targetVelocityX - state.velocityX) * velocityEasing;
    state.velocityY += (state.targetVelocityY - state.velocityY) * velocityEasing;
    state.worldOffsetX = wrapCentered(
      state.worldOffsetX + (state.velocityX * elapsedSeconds),
      QUALITY_WORLD_WIDTH
    );
    state.worldOffsetY = wrapCentered(
      state.worldOffsetY + (state.velocityY * elapsedSeconds),
      QUALITY_WORLD_HEIGHT
    );
    state.focusX += (state.targetFocusX - state.focusX) * .16;
    state.focusY += (state.targetFocusY - state.focusY) * .16;
    render();

    const unsettled = Math.abs(state.targetFocusX - state.focusX) > .12
      || Math.abs(state.targetFocusY - state.focusY) > .12
      || Math.abs(state.targetVelocityX - state.velocityX) > .12
      || Math.abs(state.targetVelocityY - state.velocityY) > .12
      || Math.abs(state.velocityX) > .12
      || Math.abs(state.velocityY) > .12;
    if (mode === "globe" || mode === "auto" || unsettled) {
      animationFrame = requestAnimationFrame(tick);
    }
  };

  const startAnimation = () => {
    if (
      animationFrame
      || !sprite
      || !visible
      || document.hidden
      || reducedMotion.matches
      || mobileLayout.matches
    ) return;
    animationFrame = requestAnimationFrame(tick);
  };

  const resetFocus = () => {
    pointerInside = false;
    state.targetFocusX = 0;
    state.targetFocusY = 0;
    state.targetVelocityX = 0;
    state.targetVelocityY = 0;
    cloud.dataset.qualityMode = getMode();
    startAnimation();
  };

  const updatePointerFocus = (event) => {
    if (!finePointer.matches) return;
    const bounds = cloud.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointerInside = true;
    const normalizedX = (((event.clientX - bounds.left) / bounds.width) - .5) * 2;
    const normalizedY = (((event.clientY - bounds.top) / bounds.height) - .5) * 2;
    const directionX = Math.max(-1, Math.min(1, normalizedX));
    const directionY = Math.max(-1, Math.min(1, normalizedY));

    // The cursor chooses a direction and speed, not a finite destination.
    // Holding it in one place therefore keeps rotating the wrapped logo field.
    state.targetVelocityX = -directionX * 52;
    state.targetVelocityY = -directionY * 38;
    state.targetFocusX = directionX * Math.min(state.width * .24, 96);
    state.targetFocusY = directionY * Math.min(state.height * .2, 64);
    cloud.dataset.qualityMode = getMode();
    startAnimation();
  };

  const handleModeChange = () => {
    cloud.dataset.qualityMode = getMode();
    stopAnimation();
    pointerInside = false;
    state.targetFocusX = 0;
    state.targetFocusY = 0;
    state.targetVelocityX = 0;
    state.targetVelocityY = 0;
    if (reducedMotion.matches) {
      state.focusX = 0;
      state.focusY = 0;
      state.worldOffsetX = 0;
      state.worldOffsetY = 0;
      state.velocityX = 0;
      state.velocityY = 0;
      render();
      return;
    }
    startAnimation();
  };

  Promise.all(sourceElements.map(waitForImage)).then((loadedImages) => {
    const images = loadedImages.filter(Boolean);
    if (!images.length) return;

    sprite = buildLogoSprite(images);
    distribution = distributeLogoIndexes(images.length, positions.length);
    if (!sprite) return;
    resize();

    cloud.setAttribute("data-quality-ready", "");
    cloud.dataset.qualityMode = getMode();
    render();
    startAnimation();
  });

  const resizeObserver = new ResizeObserver(() => {
    if (!resize()) return;
    render();
    startAnimation();
  });
  resizeObserver.observe(canvas);

  if ("IntersectionObserver" in window) {
    viewportObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      cloud.toggleAttribute("data-quality-active", visible);
      if (visible) startAnimation();
      else stopAnimation();
    }, { rootMargin: "64px 0px", threshold: .05 });
    viewportObserver.observe(cloud);
  } else {
    cloud.setAttribute("data-quality-active", "");
  }

  cloud.addEventListener("pointerenter", updatePointerFocus, { passive: true });
  cloud.addEventListener("pointermove", updatePointerFocus, { passive: true });
  cloud.addEventListener("pointerleave", resetFocus, { passive: true });
  finePointer.addEventListener("change", handleModeChange);
  mobileLayout.addEventListener("change", handleModeChange);
  reducedMotion.addEventListener("change", handleModeChange);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAnimation();
    else startAnimation();
  });
  window.addEventListener("pagehide", () => {
    stopAnimation();
    resizeObserver.disconnect();
    viewportObserver?.disconnect();
  }, { once: true });
}

function initCareWorkflow(workflow, reducedMotion) {
  const nodes = [...workflow.querySelectorAll("[data-care-node]")];
  const links = [...workflow.querySelectorAll("[data-care-link]")];
  const phase = workflow.querySelector("[data-care-phase]");
  const stage = workflow.querySelector("[data-care-stage]");
  const canvas = workflow.querySelector(".care-workflow-canvas");
  const pulse = workflow.querySelector("[data-care-pulse]");
  if (!nodes.length || !phase) return;

  const linkPaths = [
    "M 158 54 C 206 54, 152 174, 200 174",
    "M 346 174 C 394 174, 340 54, 388 54",
    "M 534 54 C 582 54, 528 174, 576 174",
  ];

  const resize = () => {
    if (!stage || !canvas) return;
    const scale = Math.min(1, stage.clientWidth / 736);
    canvas.style.setProperty("--care-scale", String(scale));
    stage.style.height = `${226 * scale}px`;
  };
  const resizeObserver = new ResizeObserver(resize);
  if (stage) resizeObserver.observe(stage);
  resize();

  const timeline = [850, 1000, 700, 1000, 700, 1000, 700, 1000, 2200];
  let step = reducedMotion ? timeline.length - 1 : 1;
  let timer = 0;

  const render = () => {
    nodes.forEach((node, index) => {
      const runningStep = 1 + (index * 2);
      const status = step === runningStep ? "running" : step > runningStep ? "done" : "pending";
      node.dataset.status = status;
      const statusLabel = node.querySelector(":scope > em");
      if (statusLabel) statusLabel.textContent = status === "running" ? "진행" : status === "done" ? "완료" : "대기";
    });

    links.forEach((link, index) => {
      const activeStep = 2 + (index * 2);
      link.dataset.state = step === activeStep ? "active" : step > activeStep ? "done" : "idle";
    });

    const activeLink = links.findIndex((link) => link.dataset.state === "active");
    if (pulse) {
      pulse.removeAttribute("data-active");
      if (activeLink >= 0) {
        pulse.style.offsetPath = `path("${linkPaths[activeLink]}")`;
        void pulse.offsetWidth;
        pulse.setAttribute("data-active", "");
      }
    }

    const complete = step === timeline.length - 1;
    phase.dataset.state = complete ? "complete" : "running";
    phase.lastChild.textContent = complete ? "완료" : "진행 중";
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      step = step >= timeline.length - 1 ? 1 : step + 1;
      render();
      schedule();
    }, timeline[step]);
  };

  render();
  if (!reducedMotion) {
    schedule();
    window.addEventListener("pagehide", () => {
      window.clearTimeout(timer);
      resizeObserver.disconnect();
    }, { once: true });
  }
}

function initLabQueue(queue, reducedMotion) {
  const card = queue.closest("[data-feature-card]");
  const stageLabel = queue.querySelector("[data-lab-stage]");
  const percentLabel = queue.querySelector("[data-lab-percent]");
  const segments = [...queue.querySelectorAll(".lab-queue-blocks i")];
  if (!card || !stageLabel || !percentLabel || !segments.length) return;

  const processStage = (step) => {
    if (step >= segments.length) return "제작 완료";
    if (step >= 6) return "임플란트 제작 중";
    if (step >= 3) return "정밀 가공 중";
    return "보철물 설계 중";
  };

  let step = reducedMotion ? segments.length : 0;
  let timer = 0;
  let previousStage = "";

  const render = () => {
    const nextStage = processStage(step);
    if (previousStage && previousStage !== nextStage && !reducedMotion) {
      stageLabel.animate(
        [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 160, easing: "ease-out" },
      );
    }
    previousStage = nextStage;
    stageLabel.textContent = nextStage;
    percentLabel.textContent = `${Math.round((step / segments.length) * 100)}%`;
    segments.forEach((segment, index) => {
      segment.toggleAttribute("data-filled", index < step);
      segment.toggleAttribute("data-latest", index === step - 1);
    });
  };

  const schedule = () => {
    window.clearTimeout(timer);
    const active = card.hasAttribute("data-visual-active");
    if (!active) {
      step = 0;
      render();
      timer = window.setTimeout(schedule, 240);
      return;
    }

    const complete = step >= segments.length;
    timer = window.setTimeout(() => {
      step = complete ? 0 : step + 1;
      render();
      schedule();
    }, complete ? 1500 : 520);
  };

  render();
  if (!reducedMotion) schedule();
  window.addEventListener("pagehide", () => window.clearTimeout(timer), { once: true });
}

function initComparisonChart(chart, reducedMotion) {
  const bars = [...chart.querySelectorAll("[data-bar-value]")];
  const card = chart.closest("[data-feature-card]");
  if (!bars.length || !card) return;

  const setProgress = (progress) => {
    bars.forEach((bar) => {
      const target = Number(bar.dataset.barValue) || 0;
      const start = Number(bar.dataset.barStart ?? target) || 0;
      const current = start + ((target - start) * progress);
      bar.style.setProperty("--bar-current", current.toFixed(2));
    });
  };

  if (reducedMotion) {
    setProgress(1);
    return;
  }

  let animationFrame = 0;
  let startedAt = 0;
  let played = false;
  const duration = 1150;
  const smoothstep = (value) => value * value * (3 - (2 * value));

  const tick = (time) => {
    if (!card.hasAttribute("data-visual-active")) {
      startedAt = 0;
      played = false;
      setProgress(0);
      animationFrame = requestAnimationFrame(tick);
      return;
    }

    if (!played) {
      if (!startedAt) startedAt = time;
      const progress = smoothstep(Math.min((time - startedAt) / duration, 1));
      setProgress(progress);
      if (progress >= 1) played = true;
    } else {
      setProgress(1);
    }
    animationFrame = requestAnimationFrame(tick);
  };

  animationFrame = requestAnimationFrame(tick);
  window.addEventListener("pagehide", () => cancelAnimationFrame(animationFrame), { once: true });
}

export function initFeatureVisuals() {
  const cards = [...document.querySelectorAll("[data-feature-card]")];
  if (!cards.length) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const qualityClouds = [...document.querySelectorAll("[data-quality-logo-cloud]")];
  // Mobile rows are inexpensive DOM/CSS and must exist before their source
  // fallback is hidden by the compact layout. Keep only the canvas sprite and
  // animation behind IntersectionObserver's lazy initialization boundary.
  qualityClouds.forEach(initQualityMobileMarquee);
  const initializedQualityClouds = new WeakSet();
  const initializeQualityCloud = (cloud) => {
    if (initializedQualityClouds.has(cloud)) return;
    initializedQualityClouds.add(cloud);
    initQualityLogoCloud(cloud, reducedMotion);
  };
  if ("IntersectionObserver" in window) {
    const qualityObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        qualityObserver.unobserve(entry.target);
        initializeQualityCloud(entry.target);
      });
    }, { rootMargin: "256px 0px" });
    qualityClouds.forEach((cloud) => qualityObserver.observe(cloud));
  } else {
    qualityClouds.forEach(initializeQualityCloud);
  }
  document.querySelectorAll("[data-care-workflow]").forEach((workflow) => {
    initCareWorkflow(workflow, reducedMotion.matches);
  });
  document.querySelectorAll("[data-lab-queue]").forEach((queue) => {
    initLabQueue(queue, reducedMotion.matches);
  });
  document.querySelectorAll("[data-comparison-chart]").forEach((chart) => {
    initComparisonChart(chart, reducedMotion.matches);
  });

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    cards.forEach((card) => card.setAttribute("data-visual-active", ""));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.toggleAttribute("data-visual-active", entry.isIntersecting);
    });
  }, { threshold: 0.35 });

  cards.forEach((card) => observer.observe(card));
}
