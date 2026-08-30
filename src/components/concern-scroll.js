import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { concerns } from "../data.js";
import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard
} from "../utils/pin-height-guard.js";
import { createResponsiveStageScrollTrigger } from "../utils/mobile-scroll.js";

gsap.registerPlugin(ScrollTrigger);

export function initConcernScroll() {
  const section = document.querySelector("[data-concern]");
  if (!section) return;
  const heading = section.querySelector("[data-concern-heading]");
  const copy = section.querySelector("[data-concern-copy]");
  const dialogue = section.querySelector("[data-concern-dialogue]");
  const patient = section.querySelector("[data-patient]");
  const header = document.querySelector("[data-header]");
  let current = -1;

  const getTextMinimumHeightRem = () => {
    const copyStyles = getComputedStyle(section.querySelector(".concern-copy"));
    const copyGap = Number.parseFloat(copyStyles.rowGap || copyStyles.gap) || 0;
    const contentHeightPixels = heading.getBoundingClientRect().height
      + dialogue.getBoundingClientRect().height
      + copyGap;

    // The illustration is intentionally allowed to crop. The pin only needs
    // enough height for the fixed header, the longest heading/bubble pair, and
    // small safe areas above and below that essential text.
    return calculatePinMinimumHeightRem({
      headerHeightPixels: header?.getBoundingClientRect().height || 0,
      contentHeightPixels,
      topSafetyRem: 1,
      bottomSafetyRem: 1
    });
  };

  const render = (index, animate = true) => {
    if (index === current) return;
    current = index;
    const item = concerns[index];
    heading.textContent = item.heading;
    copy.textContent = item.copy;
    patient.dataset.pose = String(item.pose);
    patient.setAttribute("aria-label", `${item.heading}, ${item.copy}`);
    if (!animate) return;
    gsap.fromTo([heading, dialogue], { autoAlpha: .25 }, { autoAlpha: 1, duration: .24, stagger: .04, overwrite: true });
    gsap.to(patient, { autoAlpha: 1, duration: .24, overwrite: true });
  };

  render(0, false);
  return createPinHeightGuard({
    section,
    allowMobile: true,
    minimumHeightRem: getTextMinimumHeightRem,
    onEnable: () => {
      // Each concern occupies one equal progress interval. Touch and desktop
      // wheel/trackpad gestures advance one interval at a time, preventing a
      // single high-velocity input from skipping the entire sticky story.
      return createResponsiveStageScrollTrigger({
        // Progress 1 repeats the final concern, so mobile exposes only the three
        // real stories and releases the following swipe out of the section.
        mobileStepPoints: concerns.map((_, index) => index / concerns.length),
        observeDesktopWheel: true,
        stepDuration: .1,
        vars: {
          id: "concern-pin-progress",
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: .35,
          invalidateOnRefresh: true,
          onUpdate: ({ progress }) => render(Math.min(concerns.length - 1, Math.floor(progress * concerns.length)))
        }
      });
    },
    onDisable: () => render(0, false)
  });
}
