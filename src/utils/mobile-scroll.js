import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const mobileTouchInput = matchMedia("(max-width: 48rem) and (any-pointer: coarse)");
const reducedMotionInput = matchMedia("(prefers-reduced-motion: reduce)");

// normalizeScroll() replaces the browser's native touch momentum with a GSAP
// momentum tween. The return value is that tween's duration, not a pixel
// distance. A zero duration makes short flicks move only the few pixels covered
// while the finger is touching the screen, so keep a small velocity-based
// duration instead. Duration is shortened as release velocity rises because
// travel grows from velocity × time; letting both values rise would reproduce
// the multi-scene skips this limiter exists to prevent. The scale targets a
// short inertial tail of roughly a few hundred CSS pixels on a strong flick.
const getLimitedMomentumDuration = (observer) => {
  const releaseSpeed = Math.abs(observer.velocityY);
  if (releaseSpeed < 1) return 0;
  return gsap.utils.clamp(.06, .28, 1000 / releaseSpeed);
};

export const shouldUseMobileScrollEffects = () => (
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

export function initMobileScrollNormalization() {
  let normalized = false;

  const sync = () => {
    const shouldNormalize = shouldUseMobileScrollEffects();
    if (shouldNormalize === normalized) return;
    normalized = shouldNormalize;

    if (!shouldNormalize) {
      // Desktop, precision pointers, and reduced-motion users retain the
      // browser's native scrolling and are not subject to scroll-jacking.
      ScrollTrigger.normalizeScroll(false);
      return;
    }

    ScrollTrigger.normalizeScroll({
      // Scrollable menus and other nested regions must remain independently
      // usable while the document scroll is normalized.
      allowNestedScroll: true,
      // Once a gesture is recognized as vertical, small diagonal finger
      // movement must not hand the gesture to a horizontal interaction.
      lockAxis: true,
      // Preserve a short inertial tail instead of either the device's long,
      // inconsistent native coast or the previous hard stop at zero seconds.
      momentum: getLimitedMomentumDuration,
      type: "touch"
    });
  };

  sync();
  const unsubscribe = subscribeMobileScrollEffects(sync);

  return () => {
    unsubscribe();
    if (normalized) ScrollTrigger.normalizeScroll(false);
    normalized = false;
  };
}

export function createResponsiveStageScrollTrigger({ vars, snapTo }) {
  let trigger = null;

  const create = () => {
    trigger?.kill();

    const snap = shouldUseMobileScrollEffects()
      ? {
          // Snap only after the limited momentum has settled. Disabling snap
          // inertia is intentional: the release velocity was already handled
          // by normalizeScroll(), so extrapolating it again could skip stages.
          snapTo,
          directional: true,
          inertia: false,
          delay: .08,
          duration: { min: .12, max: .24 },
          ease: "power1.out"
        }
      : undefined;

    // Omitting the snap property outside mobile touch also avoids changing the
    // native desktop/keyboard scroll behavior merely to produce a no-op snap.
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
