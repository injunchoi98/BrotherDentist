import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createBoundaryLimitedScrollTrigger } from "../utils/mobile-scroll.js";
import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard,
  getSmallViewportHeight
} from "../utils/pin-height-guard.js";
import { bindVisualViewportMetrics } from "../utils/visual-viewport.js";

gsap.registerPlugin(ScrollTrigger);

const SCRAMBLE_GLYPHS = Array.from("가나다라마바사아자차카타파하감동서울");
const TITLES = [
  { prefix: "소개 환자 많은", start: 0 },
  { prefix: "재방문하는", start: .34 },
  { prefix: "전국에서 찾아오는", start: .57 },
  { prefix: "치과에 대한 생각을 바꾸는", start: .81 }
];
const TITLE_REVEAL_DURATION = .05;
const SCENE_RANGES = [[0, .37], [.335, .595], [.555, .825]];

const REFERRAL_POSITIONS = [
  { x: -.8, y: -.82, scale: .94, rotate: -4 },
  { x: .78, y: -.68, scale: .88, rotate: 3 },
  { x: -.84, y: 0, scale: 1.02, rotate: 2 },
  { x: .8, y: .58, scale: .92, rotate: -3 },
  { x: -.78, y: .82, scale: .88, rotate: 3 }
];

const REFERRAL_POSITIONS_COMPACT = [
  { x: -.9, y: -.76, scale: .78, rotate: -4 },
  { x: .9, y: -.7, scale: .72, rotate: 4 },
  { x: -.94, y: -.31, scale: .76, rotate: -3 },
  { x: .94, y: .32, scale: .78, rotate: 3 },
  { x: -.04, y: .78, scale: .8, rotate: -3 }
];

const REFERRAL_ORBIT_PATH = [[.78, -.68], [.92, .1], [.8, .58], [0, .84], [-.78, .82], [-.84, 0], [-.8, -.82], [0, -.9], [.78, -.68]];
const REFERRAL_ORBIT_EXTENSION = [[.78, -.68], [1, -.56], [1.22, -.3]];
const REFERRAL_ORBIT_STARTS = [.72, .52, .77, .52, .8];
const REFERRAL_ORBIT_PHASES = [.75, 0, .625, .25, .5];

const REGION_SEQUENCE = ["전주", "강릉", "제주", "대전", "부산"];

/*
 * These are the two exact layout relationships used by the reference:
 * “Pixel precision” moves edge-left -> far-right -> edge-left, while
 * “Sharp contrast” moves edge-right -> quarter-haze -> edge-right.
 * The pinned scene supplies the vertical travel that normal document scroll
 * supplies on the reference page; no decorative curve or rotation is added.
 */
const TEXT_FLIP_PATTERNS = {
  pixel: { from: "edge-left", to: "far-right", fromOpacity: .55, toOpacity: .55, fromBlur: 0, toBlur: 0 },
  sharp: { from: "edge-right", to: "quarter", fromOpacity: .55, toOpacity: 1, fromBlur: 0, toBlur: 2 }
};

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const mix = (from, to, progress) => from + ((to - from) * progress);
const smooth = (value) => {
  const progress = clamp(value);
  return progress * progress * (3 - (2 * progress));
};
const cinematic = gsap.parseEase("expo.inOut");

const sceneAlpha = (progress, index) => {
  const [start, end] = SCENE_RANGES[index];
  const enter = index === 0 ? 1 : smooth((progress - start) / .032);
  const leave = smooth((end - progress) / .042);
  return Math.min(enter, leave);
};

const samplePath = (points, progress) => {
  const scaled = clamp(progress) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const local = smooth(scaled - index);
  return [
    mix(points[index][0], points[index + 1][0], local),
    mix(points[index][1], points[index + 1][1], local)
  ];
};

const sampleLoop = (points, progress) => {
  const wrapped = ((progress % 1) + 1) % 1;
  return samplePath(points, wrapped);
};

const sampleReferralOrbit = (progress) => {
  if (progress <= 1) return sampleLoop(REFERRAL_ORBIT_PATH, progress);
  return samplePath(REFERRAL_ORBIT_EXTENSION, (progress - 1) / .32);
};

const setBlur = (element, blur) => {
  const value = blur > .08 ? `blur(${blur.toFixed(2)}px)` : "none";
  if (element.style.filter !== value) element.style.filter = value;
};

const getViewportWidth = () => document.documentElement.clientWidth;

const renderTitle = (element, progress) => {
  const index = Math.max(0, TITLES.findLastIndex(({ start }) => progress >= start));
  const stage = TITLES[index];
  const reveal = stage.start === 0 ? 1 : clamp((progress - stage.start) / TITLE_REVEAL_DURATION);
  const characters = Array.from(stage.prefix);
  const revealed = Math.ceil(characters.length * reveal);
  const frame = Math.floor(progress * 520);

  const text = characters.map((character, characterIndex) => {
    if (/\s/.test(character) || characterIndex < revealed) return character;
    return SCRAMBLE_GLYPHS[(frame + (characterIndex * 7)) % SCRAMBLE_GLYPHS.length];
  }).join("");
  if (element.textContent !== text) element.textContent = text;
};

const renderReferral = (items, localProgress, alpha, viewportWidth, viewportHeight) => {
  const radiusX = Math.max(140, (viewportWidth / 2) - Math.min(152, viewportWidth * .16));
  const radiusY = Math.max(140, (viewportHeight / 2) - Math.min(150, viewportHeight * .2));
  const positions = viewportWidth < 768 ? REFERRAL_POSITIONS_COMPACT : REFERRAL_POSITIONS;
  const convoy = smooth((localProgress - .86) / .1);
  const exit = smooth((localProgress - .955) / .045);

  items.forEach((item, index) => {
    const target = positions[index] || positions.at(-1);
    const appear = smooth((localProgress - (.08 + (index * .085))) / .18);
    const orbitStart = REFERRAL_ORBIT_STARTS[index] ?? .8;
    const join = smooth((localProgress - orbitStart) / .07);
    const orbitDistance = Math.max(0, Math.min(localProgress, .86) - orbitStart) * 1.3;
    const orbitProgress = (REFERRAL_ORBIT_PHASES[index] ?? 0) + orbitDistance;
    const convoyPhase = 1.02 - (index * .004);
    const pathProgress = mix(orbitProgress, convoyPhase, convoy) + (exit * .32);
    const [orbitX, orbitY] = sampleReferralOrbit(pathProgress);
    const finalX = target.x * radiusX;
    const finalY = target.y * radiusY;
    const orbitPositionX = orbitX * radiusX;
    const orbitPositionY = orbitY * radiusY;
    const x = mix(finalX, orbitPositionX, join);
    const y = mix(finalY, orbitPositionY, join);
    const scale = mix(.06, target.scale, appear) * mix(1, .7, join) * mix(1, .72, exit);
    const opacity = alpha * appear * (1 - exit);
    const blur = ((1 - appear) * 8) + (join * (1 - convoy) * .55) + (exit * 6);
    const rotate = mix(target.rotate, -3 + (exit * 7), join);

    item.style.zIndex = `${8 + index}`;
    item.style.opacity = opacity.toFixed(3);
    setBlur(item, blur);
    item.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px), ${mix(-180, 0, appear).toFixed(2)}px) scale(${scale.toFixed(3)}) rotate(${rotate.toFixed(2)}deg)`;
  });
};

const getRowPitch = (basePitch, localProgress) => {
  const approach = smooth(localProgress / .28);
  const gather = smooth((localProgress - .28) / .22);
  const exit = smooth((localProgress - .58) / .2);

  /*
   * Reference rhythm: enter as a tight text block, briefly fan out while
   * travelling, gather back to one compact stack at focus, then leave with
   * only a small amount of air between lines.
   */
  const approachPitch = mix(.96, 1.14, approach);
  const gatheredPitch = mix(approachPitch, .9, gather);
  return basePitch * mix(gatheredPitch, 1.12, exit);
};

const getRowLayout = (count, localProgress, viewportHeight, basePitch) => {
  const gap = getRowPitch(basePitch, localProgress);
  const exitGap = getRowPitch(basePitch, 1);
  const startY = viewportHeight * .68;
  const endY = (-viewportHeight * .68) - ((count - 1) * exitGap);
  return { gap, groupY: mix(startY, endY, localProgress), startY, endY };
};

const getRowFocusProgress = (index, count, viewportHeight, basePitch) => {
  let minimum = 0;
  let maximum = 1;

  for (let iteration = 0; iteration < 14; iteration += 1) {
    const progress = (minimum + maximum) * .5;
    const { gap, groupY } = getRowLayout(count, progress, viewportHeight, basePitch);
    if (groupY + (index * gap) > 0) minimum = progress;
    else maximum = progress;
  }

  return (minimum + maximum) * .5;
};

const getRowState = (index, count, localProgress, viewportHeight, basePitch) => {
  const { gap, groupY } = getRowLayout(count, localProgress, viewportHeight, basePitch);
  const y = groupY + (index * gap);
  const focusDistance = Math.max(170, viewportHeight * .34);
  const focus = y >= 0
    ? cinematic(clamp(1 - (y / focusDistance)))
    : 1 - cinematic(clamp(-y / focusDistance));
  const enter = smooth(((viewportHeight * .68) - y) / (viewportHeight * .2));
  const leave = smooth((y + (viewportHeight * .68)) / (viewportHeight * .2));
  const scrambleReveal = smooth(((viewportHeight * .66) - y) / (viewportHeight * .18));
  return { y, focus, visibility: enter * leave, scrambleReveal };
};

const getHorizontalAnchor = (name, viewportWidth, itemWidth) => {
  const compact = viewportWidth <= 640;
  const gutter = compact ? 16 : Math.min(64, Math.max(24, viewportWidth * .04));
  const safeRight = Math.max(gutter, viewportWidth - itemWidth - gutter);
  const left = gutter;
  const farRight = Math.min(viewportWidth * (compact ? .5 : .7), safeRight);
  const quarter = gutter + (viewportWidth * (compact ? .18 : .25));
  const center = (viewportWidth - itemWidth) * .5;
  const leftPosition = name === "edge-left"
    ? left
    : name === "edge-right"
      ? safeRight
      : name === "quarter"
        ? quarter
        : name === "center"
          ? center
          : farRight;
  return leftPosition + (itemWidth * .5) - (viewportWidth * .5);
};

const renderScramble = (item, reveal, frame) => {
  const source = item.dataset.scrambleSource || item.textContent || "";
  if (!item.dataset.scrambleSource) item.dataset.scrambleSource = source;
  if (reveal >= .995) {
    if (item.textContent !== source) item.textContent = source;
    return;
  }

  const characters = Array.from(source);
  const revealed = Math.floor(characters.length * reveal);
  const text = characters.map((character, characterIndex) => {
    if (/\s/.test(character) || characterIndex < revealed) return character;
    return SCRAMBLE_GLYPHS[(frame + (characterIndex * 7)) % SCRAMBLE_GLYPHS.length];
  }).join("");
  if (item.textContent !== text) item.textContent = text;
};

const renderReferenceTextGroup = ({ items, localProgress, alpha, viewportWidth, viewportHeight, metrics, patternName }) => {
  const pattern = TEXT_FLIP_PATTERNS[patternName];
  const quarterDrop = Math.min(50, Math.max(20, viewportHeight * .05));
  const frame = Math.floor(localProgress * 520);
  const basePitch = Math.max(...items.map((item) => metrics.get(item)?.height || 0), 1);

  items.forEach((item, index) => {
    const { y, focus, visibility, scrambleReveal } = getRowState(index, items.length, localProgress, viewportHeight, basePitch);
    const itemWidth = metrics.get(item)?.width || 0;
    const fromX = getHorizontalAnchor(pattern.from, viewportWidth, itemWidth);
    const toX = getHorizontalAnchor(pattern.to, viewportWidth, itemWidth);
    const x = mix(fromX, toX, focus);
    const targetDrop = patternName === "sharp" ? quarterDrop * focus : 0;
    const opacity = alpha * visibility * mix(pattern.fromOpacity, pattern.toOpacity, focus);
    const blur = mix(pattern.fromBlur, pattern.toBlur, focus);

    renderScramble(item, scrambleReveal, frame + (index * 13));
    item.style.zIndex = `${6 + Math.round(focus * 5)}`;
    item.style.opacity = opacity.toFixed(3);
    setBlur(item, blur);
    item.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${(y + targetDrop).toFixed(2)}px), 0)`;
  });
};

const renderRevisit = (items, localProgress, alpha, viewportWidth, viewportHeight, metrics) => {
  renderReferenceTextGroup({ items, localProgress, alpha, viewportWidth, viewportHeight, metrics, patternName: "pixel" });
};

const renderRegions = (items, localProgress, alpha, viewportWidth, viewportHeight, metrics) => {
  renderReferenceTextGroup({ items, localProgress, alpha, viewportWidth, viewportHeight, metrics, patternName: "sharp" });
};

const renderMap = (map, routes, localProgress, alpha, viewportHeight, regionItems, metrics) => {
  const reveal = smooth((localProgress - .12) / .2);
  map.style.opacity = (alpha * reveal * .78).toFixed(3);
  map.style.transform = `scale(${(.9 + (reveal * .1)).toFixed(3)})`;
  const basePitch = Math.max(...regionItems.map((item) => metrics.get(item)?.height || 0), 1);

  routes.forEach((route) => {
    const cityIndex = Math.max(0, REGION_SEQUENCE.indexOf(route.dataset.city));
    const focusProgress = getRowFocusProgress(cityIndex, REGION_SEQUENCE.length, viewportHeight, basePitch);
    const drawn = smooth((localProgress - (focusProgress - .08)) / .18);
    route.style.opacity = (alpha * drawn).toFixed(3);
    route.style.strokeDashoffset = (1 - drawn).toFixed(4);
  });
};

export function initShowcaseScroll() {
  const section = document.querySelector("[data-showcase]");
  if (!section) return;

  const panel = section.querySelector("[data-showcase-panel]");
  const title = section.querySelector("[data-showcase-variable]");
  const titleLock = section.querySelector(".showcase-title-lock");
  const image = section.querySelector("[data-showcase-image]");
  const finalCopy = section.querySelector(".showcase-image-copy strong");
  const header = document.querySelector("[data-header]");
  const map = section.querySelector(".showcase-korea-map");
  const scenes = Array.from(section.querySelectorAll("[data-showcase-scene]"));
  const referralItems = Array.from(section.querySelectorAll("[data-referral-item]"));
  const revisitItems = Array.from(section.querySelectorAll("[data-revisit-item]"));
  const regionItems = Array.from(section.querySelectorAll("[data-region-item]"));
  const routes = Array.from(section.querySelectorAll(".showcase-map-routes path"));
  const motionItems = Array.from(section.querySelectorAll(".showcase-motion-item"));
  if (!panel || !title || !titleLock || !image || !map || scenes.length !== 3) return;

  const motionMetrics = new WeakMap();
  const measureMotionMetrics = () => {
    motionItems.forEach((item) => {
      const bounds = item.getBoundingClientRect();
      motionMetrics.set(item, { width: bounds.width, height: bounds.height });
    });
  };
  measureMotionMetrics();

  let mobileContext = null;
  const clearMobileMotion = () => {
    mobileContext?.revert();
    mobileContext = null;
  };

  const enableMobileMotion = () => {
    clearMobileMotion();
    if (!matchMedia("(max-width: 48rem)").matches) return;

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      routes.forEach((route) => {
        route.style.opacity = "1";
        route.style.setProperty("stroke-dashoffset", "0px", "important");
      });
      return;
    }

    const referralScene = section.querySelector('[data-showcase-scene="referral"]');
    const revisitScene = section.querySelector('[data-showcase-scene="revisit"]');
    const nationwideScene = section.querySelector('[data-showcase-scene="nationwide"]');
    const finalScene = section.querySelector(".showcase-static-final");
    const finalItems = finalScene
      ? [finalScene.querySelector("h3"), finalScene.querySelector(":scope > picture")].filter(Boolean)
      : [];

    mobileContext = gsap.context(() => {
      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "showcase-mobile-referral",
          trigger: referralScene,
          start: "top 80%",
          end: "center 54%",
          scrub: .45,
          invalidateOnRefresh: true
        }
      }).fromTo(referralItems,
        { autoAlpha: 0, y: 28, scale: .86, filter: "blur(10px)" },
        { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", stagger: .13, duration: .34 }
      );

      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "showcase-mobile-revisit",
          trigger: revisitScene,
          start: "top 82%",
          end: "center 52%",
          scrub: .45,
          invalidateOnRefresh: true
        }
      }).fromTo(revisitItems,
        { autoAlpha: 0, filter: "blur(9px)" },
        { autoAlpha: 1, filter: "blur(0px)", stagger: .12, duration: .32 }
      );

      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "showcase-mobile-routes",
          trigger: nationwideScene,
          start: "top 76%",
          end: "center 50%",
          scrub: .5,
          invalidateOnRefresh: true
        }
      }).fromTo(routes,
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, stagger: .1, duration: .45 }
      );

      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "showcase-mobile-final",
          trigger: finalScene,
          start: "top 84%",
          end: "center 58%",
          scrub: .4,
          invalidateOnRefresh: true
        }
      }).fromTo(finalItems,
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, stagger: .18, duration: .45 }
      );
    }, section);
  };

  const render = (progress) => {
    const viewportWidth = getViewportWidth();
    const viewportHeight = getSmallViewportHeight();
    renderTitle(title, progress);
    scenes.forEach((scene, index) => {
      const alpha = sceneAlpha(progress, index);
      scene.style.visibility = alpha > .005 ? "visible" : "hidden";
      scene.style.opacity = alpha.toFixed(3);
    });

    const referralProgress = clamp((progress - SCENE_RANGES[0][0]) / (SCENE_RANGES[0][1] - SCENE_RANGES[0][0]));
    const revisitProgress = clamp((progress - SCENE_RANGES[1][0]) / (SCENE_RANGES[1][1] - SCENE_RANGES[1][0]));
    const nationwideProgress = clamp((progress - SCENE_RANGES[2][0]) / (SCENE_RANGES[2][1] - SCENE_RANGES[2][0]));
    renderReferral(referralItems, referralProgress, sceneAlpha(progress, 0), viewportWidth, viewportHeight);
    renderRevisit(revisitItems, revisitProgress, sceneAlpha(progress, 1), viewportWidth, viewportHeight, motionMetrics);
    renderRegions(regionItems, nationwideProgress, sceneAlpha(progress, 2), viewportWidth, viewportHeight, motionMetrics);
    renderMap(map, routes, nationwideProgress, sceneAlpha(progress, 2), viewportHeight, regionItems, motionMetrics);

    const imageProgress = smooth((progress - .875) / .12);
    const imageVisible = imageProgress > .006;
    image.style.setProperty("--showcase-reveal", imageVisible ? imageProgress.toFixed(4) : "0");
    image.classList.toggle("is-visible", imageVisible);
    titleLock.style.opacity = `${1 - smooth((progress - .89) / .07)}`;
    titleLock.style.transform = `translateY(${(-1.25 * smooth((progress - .89) / .07)).toFixed(2)}rem)`;
  };

  const reset = () => {
    [...scenes, ...motionItems, ...routes, map, titleLock, image]
      .forEach((element) => element?.removeAttribute("style"));
    motionItems.forEach((item) => {
      if (item.dataset.scrambleSource) item.textContent = item.dataset.scrambleSource;
    });
    image.classList.remove("is-visible");
    title.textContent = TITLES[0].prefix;
  };

  const getTextMinimumHeightRem = () => {
    const lockedTitle = titleLock.querySelector("h3");
    const contentHeightPixels = Math.max(
      lockedTitle?.getBoundingClientRect().height || 0,
      finalCopy?.getBoundingClientRect().height || 0
    );

    // The photographs, map and final image are atmospheric and may crop. The
    // guard protects only the fixed header, the taller essential message and
    // modest breathing room—matching the concern and brand text-led pins.
    return calculatePinMinimumHeightRem({
      headerHeightPixels: header?.getBoundingClientRect().height || 0,
      contentHeightPixels,
      topSafetyRem: 2,
      bottomSafetyRem: 2
    });
  };

  const disposeGuard = createPinHeightGuard({
    section,
    allowMobile: true,
    minimumHeightRem: getTextMinimumHeightRem,
    onEnable: () => {
      clearMobileMotion();
      const unbindVisualViewport = bindVisualViewportMetrics(panel);
      const state = { progress: 0 };
      let disposeScrollTrigger = null;
      const context = gsap.context(() => {
        const animation = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: () => render(state.progress) });
        animation
          .addLabel("referral", 0)
          .addLabel("revisit", TITLES[1].start)
          .addLabel("nationwide", TITLES[2].start)
          .addLabel("brand", TITLES[3].start)
          .to(state, { progress: 1, duration: 1 }, 0);

        // Scene starts remain overscroll boundaries, but positions inside each
        // scene still matter: the floating words, photos and map keep following
        // small wheel/touch deltas continuously instead of jumping by index.
        const sceneBoundaries = [
          ...TITLES.map(({ start }) => start === 0 ? 0 : start + TITLE_REVEAL_DURATION),
          1
        ];
        disposeScrollTrigger = createBoundaryLimitedScrollTrigger({
          boundaryPoints: sceneBoundaries,
          vars: {
            id: "showcase-scroll",
            trigger: section,
            animation,
            start: "top top",
            end: "bottom bottom",
            scrub: .7,
            invalidateOnRefresh: true,
            onRefreshInit: measureMotionMetrics
          }
        });
        render(0);
      }, section);

      return () => {
        disposeScrollTrigger?.();
        context.revert();
        unbindVisualViewport();
      };
    },
    onDisable: () => {
      reset();
      enableMobileMotion();
    }
  });

  return () => {
    clearMobileMotion();
    disposeGuard();
  };
}
