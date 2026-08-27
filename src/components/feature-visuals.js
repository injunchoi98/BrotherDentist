const QUALITY_TILE_STEP = 46;
const QUALITY_TILE_ROW_STEP = QUALITY_TILE_STEP * Math.sin(Math.PI / 3);
const QUALITY_TILE_RADIUS = QUALITY_TILE_STEP / 2;
const QUALITY_COLUMNS = 15;
const QUALITY_ROWS = 19;
const QUALITY_FIELD_WIDTH = QUALITY_TILE_STEP * QUALITY_COLUMNS;
const QUALITY_FIELD_HEIGHT = QUALITY_TILE_ROW_STEP * QUALITY_ROWS;
const QUALITY_FIELD_HALF_HEIGHT = QUALITY_FIELD_HEIGHT / 2;
const QUALITY_FRAME_MS = 1000 / 60;

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

function loadImage(source) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
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
  const tileSize = 44;
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
  const canvas = cloud.querySelector("[data-quality-logo-canvas]");
  const sourceElements = [...cloud.querySelectorAll("[data-quality-logo-source]")];
  if (!canvas || !sourceElements.length) return;

  const card = cloud.closest("[data-feature-card]");
  const context = canvas.getContext("2d");
  if (!card || !context) return;

  const sources = [...new Set(sourceElements.map((image) => image.getAttribute("src")).filter(Boolean))];
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
    panX: -((QUALITY_TILE_STEP * Math.floor(QUALITY_COLUMNS / 2)) + QUALITY_TILE_RADIUS),
    panY: -(QUALITY_COLUMNS * QUALITY_TILE_ROW_STEP),
    velocityX: 0,
    velocityY: 0,
    targetVelocityX: 0,
    targetVelocityY: 0,
    centerX: 0,
    centerY: 0,
    width: 0,
    height: 0,
    pixelRatio: 1,
    hovering: false,
  };

  let sprite = null;
  let distribution = [];
  let animationFrame = 0;
  let previousTime = 0;

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
      let offsetX = position.x + state.panX - (QUALITY_FIELD_WIDTH / 2);
      let offsetY = position.y + state.panY - QUALITY_FIELD_HALF_HEIGHT;
      offsetX = ((offsetX % QUALITY_FIELD_WIDTH) + QUALITY_FIELD_WIDTH) % QUALITY_FIELD_WIDTH - (QUALITY_FIELD_WIDTH / 2);
      offsetY = ((offsetY % QUALITY_FIELD_HEIGHT) + QUALITY_FIELD_HEIGHT) % QUALITY_FIELD_HEIGHT - QUALITY_FIELD_HALF_HEIGHT;

      const radialStrength = Math.exp(-((offsetX * offsetX) + (offsetY * offsetY)) / 33800);
      const scale = .18 + (1.17 * radialStrength);
      const perspective = 1 + ((scale - .18) * .5);
      const x = (offsetX * perspective) + state.centerX;
      const y = (offsetY * perspective) + state.centerY;
      const size = 44 * scale;
      const halfSize = size / 2;
      if (x + halfSize < 0 || x - halfSize > state.width || y + halfSize < 0 || y - halfSize > state.height) return;

      context.globalAlpha = .68 + (.32 * radialStrength);
      context.drawImage(
        sprite,
        distribution[index] * 88,
        0,
        88,
        88,
        x - halfSize,
        y - halfSize,
        size,
        size,
      );
    });
    context.globalAlpha = 1;
  };

  const animate = (time) => {
    const elapsed = previousTime ? time - previousTime : QUALITY_FRAME_MS;
    previousTime = time;

    const desktop = matchMedia("(min-width: 64rem)").matches;
    if (!state.hovering) {
      state.targetVelocityX = desktop ? 0 : .35;
      state.targetVelocityY = desktop ? 0 : .12;
    }

    const frameRatio = Math.min(elapsed / QUALITY_FRAME_MS, 3);
    const easing = 1 - (.94 ** frameRatio);
    state.velocityX += (state.targetVelocityX - state.velocityX) * easing;
    state.velocityY += (state.targetVelocityY - state.velocityY) * easing;
    state.panX += state.velocityX * frameRatio;
    state.panY += state.velocityY * frameRatio;
    render();
    animationFrame = requestAnimationFrame(animate);
  };

  const onPointerEnter = (event) => {
    if (event.pointerType === "mouse") state.hovering = true;
  };
  const onPointerMove = (event) => {
    if (!state.hovering) return;
    const bounds = card.getBoundingClientRect();
    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;
    const normalizedX = (event.clientX - bounds.left - halfWidth) / (halfWidth || 1);
    const normalizedY = (event.clientY - bounds.top - halfHeight) / (halfHeight || 1);
    state.targetVelocityX = -(5 * normalizedX);
    state.targetVelocityY = -(5 * normalizedY);
  };
  const onPointerLeave = () => {
    state.hovering = false;
  };

  Promise.all(sources.map(loadImage)).then((loadedImages) => {
    const images = loadedImages.filter(Boolean);
    if (!images.length) return;

    sprite = buildLogoSprite(images);
    distribution = distributeLogoIndexes(images.length, positions.length);
    if (!sprite) return;
    resize();

    cloud.setAttribute("data-quality-ready", "");
    render();
    if (!reducedMotion) animationFrame = requestAnimationFrame(animate);
  });

  const resizeObserver = new ResizeObserver(() => {
    if (resize()) render();
  });
  resizeObserver.observe(canvas);

  if (!reducedMotion) {
    card.addEventListener("pointerenter", onPointerEnter);
    card.addEventListener("pointermove", onPointerMove);
    card.addEventListener("pointerleave", onPointerLeave);
    card.addEventListener("pointercancel", onPointerLeave);
    window.addEventListener("pagehide", () => cancelAnimationFrame(animationFrame), { once: true });
  }
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
  document.querySelectorAll("[data-quality-logo-cloud]").forEach((cloud) => {
    initQualityLogoCloud(cloud, reducedMotion.matches);
  });
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
