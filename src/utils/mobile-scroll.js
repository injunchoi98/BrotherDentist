import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const mobileTouchInput = matchMedia("(max-width: 48rem) and (any-pointer: coarse)");
const reducedMotionInput = matchMedia("(prefers-reduced-motion: reduce)");

// Outside a step-controlled story, touch scrolling stays entirely native. This
// module never calls normalizeScroll(), so iOS and Android retain their normal
// browser momentum. Inside an opted-in story, Observer converts one deliberate
// touch gesture into one stage change. No ScrollTrigger snap is attached on
// either mobile or desktop.
const shouldUseMobileStageEffects = () => (
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

const clampProgress = gsap.utils.clamp(0, 1);

const prepareStepPoints = (points) => [
  ...new Set(points.map((point) => clampProgress(point)))
].sort((a, b) => a - b);

export function createResponsiveStageScrollTrigger({
  vars,
  mobileStepPoints = null
}) {
  let trigger = null;
  let intentObserver = null;
  let stepObserver = null;
  let stepTween = null;
  let gestureConsumed = false;

  const destroyInstances = () => {
    stepTween?.kill();
    stepTween = null;
    intentObserver?.kill();
    intentObserver = null;
    stepObserver?.kill();
    stepObserver = null;
    trigger?.kill();
    trigger = null;
  };

  const create = () => {
    destroyInstances();

    const mobileStageEffects = shouldUseMobileStageEffects();
    const stepPoints = mobileStageEffects && Array.isArray(mobileStepPoints)
      ? prepareStepPoints(mobileStepPoints)
      : [];

    const {
      onEnter: originalOnEnter,
      onEnterBack: originalOnEnterBack,
      onLeave: originalOnLeave,
      onLeaveBack: originalOnLeaveBack,
      ...triggerVars
    } = vars;

    if (stepPoints.length) {
      // This passive observer remembers the touch event that was already in
      // progress when native scrolling first carries the page into the sticky
      // range. Passing that event to enable() lets the controlling observer
      // take over the same gesture instead of waiting for a second touch.
      intentObserver = ScrollTrigger.observe({
        target: window,
        type: "touch"
      });

      const progressToScroll = (progress, controller = trigger) => {
        const range = controller.end - controller.start;
        const boundaryInset = progress === 0 ? 1 : progress === 1 ? -1 : 0;
        return controller.start + range * progress + boundaryInset;
      };

      const tweenToScroll = (
        position,
        duration = .32,
        controller = trigger,
        onComplete = null
      ) => {
        stepTween?.kill();
        const scrollState = { position: controller.scroll() };
        stepTween = gsap.to(scrollState, {
          position,
          duration,
          ease: "power2.out",
          overwrite: true,
          onUpdate: () => controller.scroll(scrollState.position),
          onComplete: () => {
            stepTween = null;
            onComplete?.();
          }
        });
      };

      const moveOneStep = (direction) => {
        if (!trigger || stepTween?.isActive()) return;
        const progress = clampProgress(trigger.progress);
        const epsilon = .001;
        const nextPoint = direction > 0
          ? stepPoints.find((point) => point > progress + epsilon)
          : stepPoints.findLast((point) => point < progress - epsilon);

        if (nextPoint !== undefined) {
          tweenToScroll(progressToScroll(nextPoint));
          return;
        }

        // The first and last content stages are real exit gates, not duplicate
        // steps. Move just beyond the ScrollTrigger range and relinquish touch
        // control so the following gesture uses native page scrolling. Mobile
        // snap is deliberately absent here, so nothing can pull the page back.
        stepObserver.disable();
        tweenToScroll(
          direction > 0 ? trigger.end + 2 : trigger.start - 2,
          .24,
          trigger
        );
      };

      const consumeGesture = (direction) => {
        // Observer may report several threshold crossings during one long or
        // fast swipe. The press-to-release latch guarantees at most one stage.
        if (gestureConsumed) return;
        gestureConsumed = true;
        moveOneStep(direction);
      };

      stepObserver = ScrollTrigger.observe({
        target: window,
        type: "touch",
        preventDefault: true,
        allowClicks: true,
        lockAxis: true,
        dragMinimum: 8,
        tolerance: 24,
        ignore: "a, button, input, textarea, select, [data-nav]",
        onPress: (self) => {
          gestureConsumed = false;
          // Observer intentionally leaves touchstart alone by default so taps
          // stay usable. Once this story owns a drag, prevent that press from
          // seeding another native momentum scroll underneath the step tween.
          if (ScrollTrigger.isTouch) self.event.preventDefault();
        },
        // A finger moving upward advances the page; moving downward returns.
        onUp: () => consumeGesture(1),
        onDown: () => consumeGesture(-1)
      });
      stepObserver.disable();

      const enterStepRange = (self, entryPoint) => {
        const activeTouchEvent = intentObserver.isPressed ? intentObserver.event : undefined;
        stepObserver.enable(activeTouchEvent);
        // Treat the gesture that crossed into the section as the entry action.
        // This stops its native momentum at the first visible story instead of
        // also advancing a second story during the same press.
        gestureConsumed = Boolean(activeTouchEvent);
        tweenToScroll(progressToScroll(entryPoint, self), .18, self);
      };

      trigger = ScrollTrigger.create({
        ...triggerVars,
        onEnter: (self) => {
          originalOnEnter?.(self);
          enterStepRange(self, stepPoints[0]);
        },
        onEnterBack: (self) => {
          originalOnEnterBack?.(self);
          enterStepRange(self, stepPoints.at(-1));
        },
        onLeave: (self) => {
          originalOnLeave?.(self);
          stepObserver.disable();
        },
        onLeaveBack: (self) => {
          originalOnLeaveBack?.(self);
          stepObserver.disable();
        }
      });

      // A page restored or opened inside the trigger does not necessarily fire
      // an entry callback during creation, so synchronize the observer once.
      if (trigger.isActive) {
        stepObserver.enable();
      }
    } else {
      // Desktop and reduced-motion configurations use the browser's resting
      // position as-is. Snap is intentionally disabled throughout the site.
      trigger = ScrollTrigger.create(vars);
    }
  };

  create();
  const unsubscribe = subscribeMobileScrollEffects(create);

  return () => {
    unsubscribe();
    destroyInstances();
  };
}
