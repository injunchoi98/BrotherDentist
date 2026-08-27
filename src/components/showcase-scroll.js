import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createPinHeightGuard, getSmallViewportHeight } from "../utils/pin-height-guard.js";

gsap.registerPlugin(ScrollTrigger);

const SCRAMBLE_GLYPHS = Array.from("가나다라마바사아자차카타파하감동서울");
const TITLES = [
  { prefix: "소개 환자 많은", start: 0 },
  { prefix: "재방문하는", start: .34 },
  { prefix: "전국에서 찾아오는", start: .57 },
  { prefix: "치과에 대한 생각을 바꾸는", start: .81 }
];
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

const REVISIT_PATHS = {
  revisit: [[-.42, -.2], [-.31, -.15], [-.29, -.15], [-.42, -.2]],
  longterm: [[.42, -.2], [.31, -.15], [.29, -.15], [.42, -.2]],
  "checkup-count": [[-.42, .2], [-.31, .15], [-.29, .15], [-.42, .2]],
  next: [[.42, .2], [.31, .15], [.29, .15], [.42, .2]],
  checkup: [[-.58, -.02], [-.53, -.02], [-.51, -.02], [-.58, -.02]],
  aftercare: [[.56, .02], [.51, .02], [.49, .02], [.56, .02]]
};

const REVISIT_PATHS_COMPACT = {
  checkup: [[-.6, -.41], [-.54, -.37], [-.52, -.37], [-.6, -.41]],
  revisit: [[.5, -.34], [.45, -.3], [.43, -.3], [.5, -.34]],
  longterm: [[-.57, -.22], [-.51, -.2], [-.49, -.2], [-.57, -.22]],
  aftercare: [[.55, .2], [.49, .18], [.47, .18], [.55, .2]],
  "checkup-count": [[-.54, .31], [-.48, .28], [-.46, .28], [-.54, .31]],
  next: [[.57, .41], [.51, .37], [.49, .37], [.57, .41]]
};

const REGION_MOTIONS = [
  { entry: [.64, .48], approach: [.23, .28], cluster: [-.12, .17] },
  { entry: [.7, .56], approach: [.18, .31], cluster: [-.06, .21] },
  { entry: [.77, .47], approach: [.12, .25], cluster: [0, .25] },
  { entry: [.74, .65], approach: [.06, .34], cluster: [.06, .29] },
  { entry: [.83, .58], approach: [0, .3], cluster: [.12, .33] }
];
const REGION_EXIT_CONTROL = [-.38, -1.02];
const REGION_EXIT_DESTINATION = [1.18, -.24];

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const mix = (from, to, progress) => from + ((to - from) * progress);
const smooth = (value) => {
  const progress = clamp(value);
  return progress * progress * (3 - (2 * progress));
};

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

const sampleQuadratic = (from, control, to, progress) => {
  const curved = smooth(progress);
  const inverse = 1 - curved;
  return [
    (inverse * inverse * from[0]) + (2 * inverse * curved * control[0]) + (curved * curved * to[0]),
    (inverse * inverse * from[1]) + (2 * inverse * curved * control[1]) + (curved * curved * to[1])
  ];
};

const setBlur = (element, blur) => {
  const value = blur > .08 ? `blur(${blur.toFixed(2)}px)` : "none";
  if (element.style.filter !== value) element.style.filter = value;
};

const getViewportWidth = () => document.documentElement.clientWidth;

const renderTitle = (element, lock, progress) => {
  const index = Math.max(0, TITLES.findLastIndex(({ start }) => progress >= start));
  const stage = TITLES[index];
  const reveal = stage.start === 0 ? 1 : clamp((progress - stage.start) / .05);
  const characters = Array.from(stage.prefix);
  const revealed = Math.ceil(characters.length * reveal);
  const frame = Math.floor(progress * 520);

  const text = characters.map((character, characterIndex) => {
    if (/\s/.test(character) || characterIndex < revealed) return character;
    return SCRAMBLE_GLYPHS[(frame + (characterIndex * 7)) % SCRAMBLE_GLYPHS.length];
  }).join("");
  if (element.textContent !== text) element.textContent = text;

  const finalTitle = index === TITLES.length - 1;
  if (lock.hasAttribute("data-final-title") !== finalTitle) lock.toggleAttribute("data-final-title", finalTitle);
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

const renderRevisit = (items, localProgress, alpha, viewportWidth, viewportHeight) => {
  const radiusX = viewportWidth * .5;
  const radiusY = viewportHeight * .5;
  const paths = viewportWidth < 768 ? REVISIT_PATHS_COMPACT : REVISIT_PATHS;

  items.forEach((item, index) => {
    const delayed = clamp((localProgress - (.04 + (index * .025))) / .88);
    const path = paths[item.dataset.motion] || Object.values(paths)[index % Object.keys(paths).length];
    const [normalizedX, normalizedY] = samplePath(path, delayed);
    const enter = smooth(delayed / .11);
    const leave = smooth((1 - delayed) / .13);
    const depth = Math.sin(delayed * Math.PI);
    const rotate = ((index % 2 ? -1 : 1) * (1 - depth) * 2);

    item.style.opacity = (alpha * enter * leave * (.58 + (depth * .42))).toFixed(3);
    setBlur(item, (1 - depth) * 1.15);
    item.style.transform = `translate3d(calc(-50% + ${(normalizedX * radiusX).toFixed(2)}px), calc(-50% + ${(normalizedY * radiusY).toFixed(2)}px), 0) rotate(${rotate.toFixed(2)}deg)`;
  });
};

const renderRegions = (items, localProgress, alpha, viewportWidth, viewportHeight) => {
  const radiusX = viewportWidth * .5;
  const radiusY = viewportHeight * .5;
  const arrival = smooth((localProgress - .12) / .38);
  const depart = smooth((localProgress - .61) / .31);
  const fade = smooth((localProgress - .82) / .13);

  items.forEach((item, index) => {
    const motion = REGION_MOTIONS[index] || REGION_MOTIONS.at(-1);
    const enter = smooth((localProgress - (.04 + (index * .03))) / .13);
    const inCluster = sampleQuadratic(motion.entry, motion.approach, motion.cluster, arrival);
    const trailProgress = clamp(depart - (index * .028));
    const [exitX, exitY] = sampleQuadratic(motion.cluster, REGION_EXIT_CONTROL, REGION_EXIT_DESTINATION, trailProgress);
    const x = (depart > 0 ? exitX : inCluster[0]) * radiusX;
    const y = (depart > 0 ? exitY : inCluster[1]) * radiusY;
    const middleBlur = smooth((arrival - .44) / .18) * (1 - smooth((arrival - .8) / .14)) * 2.8;
    const departureBlur = smooth((trailProgress - .82) / .18) * .4;
    const blur = middleBlur + departureBlur;

    item.style.opacity = (alpha * enter * (1 - fade)).toFixed(3);
    setBlur(item, blur);
    item.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px), 0)`;
  });
};

const renderMap = (map, routes, localProgress, alpha) => {
  const reveal = smooth((localProgress - .28) / .18);
  map.style.opacity = (alpha * reveal * .78).toFixed(3);
  map.style.transform = `scale(${(.9 + (reveal * .1)).toFixed(3)})`;

  routes.forEach((route, index) => {
    const drawn = smooth((localProgress - (.46 + (index * .04))) / .34);
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
  const map = section.querySelector(".showcase-korea-map");
  const scenes = Array.from(section.querySelectorAll("[data-showcase-scene]"));
  const referralItems = Array.from(section.querySelectorAll("[data-referral-item]"));
  const revisitItems = Array.from(section.querySelectorAll("[data-revisit-item]"));
  const regionItems = Array.from(section.querySelectorAll("[data-region-item]"));
  const routes = Array.from(section.querySelectorAll(".showcase-map-routes path"));
  const motionItems = Array.from(section.querySelectorAll(".showcase-motion-item"));
  if (!panel || !title || !titleLock || !image || !map || scenes.length !== 3) return;

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
    renderTitle(title, titleLock, progress);
    scenes.forEach((scene, index) => {
      const alpha = sceneAlpha(progress, index);
      scene.style.visibility = alpha > .005 ? "visible" : "hidden";
      scene.style.opacity = alpha.toFixed(3);
    });

    const referralProgress = clamp((progress - SCENE_RANGES[0][0]) / (SCENE_RANGES[0][1] - SCENE_RANGES[0][0]));
    const revisitProgress = clamp((progress - SCENE_RANGES[1][0]) / (SCENE_RANGES[1][1] - SCENE_RANGES[1][0]));
    const nationwideProgress = clamp((progress - SCENE_RANGES[2][0]) / (SCENE_RANGES[2][1] - SCENE_RANGES[2][0]));
    renderReferral(referralItems, referralProgress, sceneAlpha(progress, 0), viewportWidth, viewportHeight);
    renderRevisit(revisitItems, revisitProgress, sceneAlpha(progress, 1), viewportWidth, viewportHeight);
    renderRegions(regionItems, nationwideProgress, sceneAlpha(progress, 2), viewportWidth, viewportHeight);
    renderMap(map, routes, nationwideProgress, sceneAlpha(progress, 2));

    const imageProgress = smooth((progress - .875) / .12);
    image.style.setProperty("--showcase-reveal", imageProgress.toFixed(4));
    image.classList.toggle("is-visible", progress > .875);
    titleLock.style.opacity = `${1 - smooth((progress - .89) / .07)}`;
    titleLock.style.transform = `translateY(${(-1.25 * smooth((progress - .89) / .07)).toFixed(2)}rem)`;
  };

  const reset = () => {
    [...scenes, ...motionItems, ...routes, map, titleLock, image]
      .forEach((element) => element?.removeAttribute("style"));
    image.classList.remove("is-visible");
    titleLock.removeAttribute("data-final-title");
    title.textContent = TITLES[0].prefix;
  };

  const disposeGuard = createPinHeightGuard({
    section,
    minimumHeightRem: ({ layout }) => {
      if (layout === "mobile") return 42;
      if (layout === "medium") return 45;
      return 42;
    },
    onEnable: () => {
      clearMobileMotion();
      const state = { progress: 0 };
      const context = gsap.context(() => {
        const animation = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: () => render(state.progress) });
        animation
          .addLabel("referral", 0)
          .addLabel("revisit", TITLES[1].start)
          .addLabel("nationwide", TITLES[2].start)
          .addLabel("brand", TITLES[3].start)
          .to(state, { progress: 1, duration: 1 }, 0);
        ScrollTrigger.create({
          id: "showcase-scroll",
          trigger: section,
          animation,
          start: "top top",
          end: "bottom bottom",
          scrub: .7,
          invalidateOnRefresh: true
        });
        render(0);
      }, section);

      return () => {
        context.revert();
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
