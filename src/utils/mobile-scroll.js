import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const mobileTouchInput = matchMedia("(max-width: 48rem) and (any-pointer: coarse)");
const reducedMotionInput = matchMedia("(prefers-reduced-motion: reduce)");

// Touch scrolling itself stays entirely native. In particular, this module no
// longer calls normalizeScroll(), so iOS and Android keep their browser-defined
// momentum instead of receiving a shortened GSAP momentum tween. Only the
// stage-settling snap below defaults to coarse mobile input. Individual pinned
// stories can opt wheel, trackpad, and keyboard input into the same behavior.
const shouldUseMobileStageSnap = () => (
  mobileTouchInput.matches && !reducedMotionInput.matches
);

const subscribeMobileScrollEffects = (listener) => {
  mobileTouchInput.addEventListener("change", listener);
  reducedMotionInput.addEventListener("change", listener);
  return () => {
    mobileTouchInput.removeEventListener("change", listener);
    reducedMotionInput.removeEventListener("change", listener);
  };
};

export function createResponsiveStageScrollTrigger({ vars, snapTo, snapOnAllInputs = false }) {
  let trigger = null;

  const create = () => {
    trigger?.kill();

    const mobileStageSnap = shouldUseMobileStageSnap();
    const snapEnabled = !reducedMotionInput.matches && (mobileStageSnap || snapOnAllInputs);
    const snap = snapEnabled
      ? {
          // Wait until the browser's native momentum has settled, then choose
          // the next stage from the actual resting position. Snap inertia stays
          // disabled so GSAP does not extrapolate the release velocity a second
          // time and accidentally skip another stage.
          snapTo,
          directional: mobileStageSnap,
          inertia: false,
          delay: .08,
          duration: { min: .12, max: .24 },
          ease: "power1.out"
        }
      : undefined;

    // Most sections retain mobile-only snapping. Sections that explicitly opt
    // in use nearest-stage snapping for wheel, trackpad, and keyboard input too.
    trigger = ScrollTrigger.create({
      ...vars,
      ...(snap ? { snap } : {})
    });
  };

  create();
  const unsubscribe = subscribeMobileScrollEffects(create);

  return () => {
    unsubscribe();
    trigger?.kill();
    trigger = null;
  };
}
