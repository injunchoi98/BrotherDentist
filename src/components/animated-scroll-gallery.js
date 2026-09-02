import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createPinHeightGuard } from "../utils/pin-height-guard.js";

gsap.registerPlugin(ScrollTrigger);

const COLUMN_RANGES = {
  "outer-left": [-10, 2],
  left: [-10, 2],
  center: [15, 5],
  right: [-10, 2],
  "outer-right": [-10, 2],
};

const setGalleryEndState = (grid, columns) => {
  gsap.set(grid, { rotateX: 0, scale: 1 });
  columns.forEach((column) => {
    const [, end] = COLUMN_RANGES[column.dataset.galleryColumn] || [0, -10];
    gsap.set(column, { yPercent: end });
  });
};

const initIntroStagger = (root) => {
  const intro = root.querySelector("[data-gallery-intro]");
  const items = [...(intro?.querySelectorAll("[data-gallery-intro-item]") || [])];
  if (!intro || !items.length) return () => {};

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.set(items, { clearProps: "filter,opacity,transform" });
    return () => {};
  }

  gsap.set(items, { filter: "blur(10px)", opacity: 0 });
  const tween = gsap.to(items, {
    filter: "blur(0px)",
    opacity: 1,
    duration: 0.3,
    stagger: 0.2,
    ease: "back.out(1.15)",
    scrollTrigger: {
      trigger: intro,
      start: "top 90%",
      once: true,
    },
  });

  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
    gsap.set(items, { clearProps: "filter,opacity,transform" });
  };
};

export function initAnimatedScrollGallery(root) {
  if (!root) return () => {};

  const scrollContainer = root.querySelector("[data-gallery-scroll]");
  const grid = root.querySelector("[data-gallery-grid]");
  const columns = [...root.querySelectorAll("[data-gallery-column]")];
  if (!scrollContainer || !grid || columns.length < 3) return () => {};

  const disposeIntro = initIntroStagger(root);
  const disposePinGuard = createPinHeightGuard({
    section: scrollContainer,
    minimumHeightRem: () => 30,
    allowMobile: true,
    onEnable: () => {
      gsap.set(grid, {
        rotateX: 75,
        scale: 1.2,
        transformOrigin: "50% 50%",
        force3D: true,
      });
      columns.forEach((column) => {
        const [start] = COLUMN_RANGES[column.dataset.galleryColumn] || [0, -10];
        gsap.set(column, { yPercent: start, force3D: true });
      });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: scrollContainer,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      timeline
        .to(grid, { rotateX: 0, duration: 0.5 }, 0)
        .to(grid, { scale: 1, duration: 0.4 }, 0.5);

      columns.forEach((column) => {
        const [start, end] = COLUMN_RANGES[column.dataset.galleryColumn] || [0, -10];
        timeline.fromTo(
          column,
          { yPercent: start },
          { yPercent: end, duration: 0.5 },
          0.5,
        );
      });

      return () => {
        timeline.scrollTrigger?.kill();
        timeline.kill();
      };
    },
    onDisable: () => setGalleryEndState(grid, columns),
  });

  return () => {
    disposeIntro();
    disposePinGuard();
    gsap.set([grid, ...columns], { clearProps: "transform,filter,opacity" });
  };
}
