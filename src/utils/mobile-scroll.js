import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const mobileTouchInput = matchMedia("(max-width: 48rem) and (any-pointer: coarse)");
const reducedMotionInput = matchMedia("(prefers-reduced-motion: reduce)");

// Outside a step-controlled story, touch scrolling stays entirely native. This
// module never calls normalizeScroll(), so iOS and Android retain their normal
// browser momentum. Inside an opted-in story, input is either converted to one
// discrete stage (concerns) or limited only at the next meaningful boundary
// (showcase). No ScrollTrigger snap is attached on mobile or desktop.
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
  mobileStepPoints = null,
  observeDesktopWheel = false,
  stepDuration = .18
}) {
  let trigger = null;
  let intentObserver = null;
  let stepObserver = null;
  let wheelObserver = null;
  let stepTween = null;
  let queuedDirection = 0;
  let gestureConsumed = false;
  let wheelGestureConsumed = false;
  let wheelGesturePeak = 0;
  let lastWheelStepAt = 0;

  const destroyInstances = () => {
    stepTween?.kill();
    stepTween = null;
    intentObserver?.kill();
    intentObserver = null;
    stepObserver?.kill();
    stepObserver = null;
    wheelObserver?.kill();
    wheelObserver = null;
    trigger?.kill();
    trigger = null;
  };

  const create = () => {
    destroyInstances();

    const mobileStageEffects = shouldUseMobileStageEffects();
    const desktopWheelEffects = observeDesktopWheel
      && !mobileTouchInput.matches
      && !reducedMotionInput.matches;
    const stepPoints = (mobileStageEffects || desktopWheelEffects) && Array.isArray(mobileStepPoints)
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
      if (mobileStageEffects) {
        intentObserver = ScrollTrigger.observe({
          target: window,
          type: "touch"
        });
      }

      const progressToScroll = (progress, controller = trigger) => {
        const range = controller.end - controller.start;
        const boundaryInset = progress === 0 ? 1 : progress === 1 ? -1 : 0;
        return controller.start + range * progress + boundaryInset;
      };

      const tweenToScroll = (
        position,
        duration = stepDuration,
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
            if (!queuedDirection) return;
            const direction = queuedDirection;
            queuedDirection = 0;
            moveOneStep(direction);
          }
        });
      };

      const moveOneStep = (direction) => {
        if (!trigger) return;
        // A genuinely separate second swipe/wheel gesture can arrive while the
        // short settling tween is finishing. Preserve that intent instead of
        // dropping it, but keep only one queued direction to avoid catch-up.
        if (stepTween?.isActive()) {
          queuedDirection = direction;
          return;
        }
        const scrollPosition = trigger.scroll();
        if (direction > 0 && scrollPosition < trigger.start) {
          tweenToScroll(progressToScroll(stepPoints[0]));
          return;
        }
        if (direction < 0 && scrollPosition > trigger.end) {
          tweenToScroll(progressToScroll(stepPoints.at(-1)));
          return;
        }
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
        // steps. Move just beyond the ScrollTrigger range and relinquish any
        // touch control so the following gesture uses native page scrolling.
        // Desktop wheel mode has no touch observer to disable.
        stepObserver?.disable();
        tweenToScroll(
          direction > 0 ? trigger.end + 2 : trigger.start - 2,
          stepDuration,
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

      if (mobileStageEffects) {
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
            // A new physical press is a new intent even if the preceding short
            // tween has not quite finished; moveOneStep queues it safely.
            if (ScrollTrigger.isTouch && self.event.cancelable) self.event.preventDefault();
          },
          // A finger moving upward advances the page; moving downward returns.
          onUp: () => consumeGesture(1),
          onDown: () => consumeGesture(-1)
        });
        stepObserver.disable();
      }

      if (desktopWheelEffects) {
        const wheelDeltaPixels = (event) => event.deltaY * (
          event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
        );
        const wheelIntersectsRange = (event) => {
          if (!trigger || event.ctrlKey) return false;
          const current = trigger.scroll();
          const projected = current + wheelDeltaPixels(event);
          return event.deltaY > 0
            ? current < trigger.end && projected >= trigger.start
            : current > trigger.start && projected <= trigger.end;
        };

        // Keep this Observer enabled so a large desktop wheel/trackpad gesture
        // can be caught before native scrolling jumps across the whole section.
        // ignoreCheck runs before preventDefault inside GSAP Observer, so wheel
        // behavior remains completely native everywhere else on the page.
        wheelObserver = ScrollTrigger.observe({
          target: window,
          type: "wheel",
          preventDefault: true,
          debounce: false,
          onStopDelay: .04,
          ignore: "a, button, input, textarea, select, [data-nav]",
          ignoreCheck: (event) => !wheelIntersectsRange(event),
          onWheel: (self) => {
            const now = performance.now();
            const magnitude = Math.abs(self.event?.deltaY ?? self.deltaY);
            // A new trackpad stroke may begin before the preceding momentum tail
            // reaches onStop. After 180ms, only a renewed near-peak impulse is
            // accepted; a smaller decaying tail remains part of the old gesture.
            const renewedImpulse = wheelGestureConsumed
              && now - lastWheelStepAt >= 180
              && magnitude >= Math.max(24, wheelGesturePeak * .85);
            if (wheelGestureConsumed && !renewedImpulse) {
              wheelGesturePeak = Math.max(wheelGesturePeak, magnitude);
              return;
            }
            wheelGestureConsumed = true;
            wheelGesturePeak = magnitude;
            lastWheelStepAt = now;
            moveOneStep(self.deltaY > 0 ? 1 : -1);
          },
          // Momentum emits wheel events every frame. Forty quiet milliseconds
          // marks a new deliberate motion without imposing a perceptible lock.
          onStop: () => {
            wheelGestureConsumed = false;
            wheelGesturePeak = 0;
          }
        });
      }

      const enterStepRange = (self, entryPoint) => {
        const activeTouchEvent = intentObserver?.isPressed ? intentObserver.event : undefined;
        stepObserver?.enable(activeTouchEvent);
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
          if (mobileStageEffects) enterStepRange(self, stepPoints[0]);
        },
        onEnterBack: (self) => {
          originalOnEnterBack?.(self);
          if (mobileStageEffects) enterStepRange(self, stepPoints.at(-1));
        },
        onLeave: (self) => {
          originalOnLeave?.(self);
          stepObserver?.disable();
        },
        onLeaveBack: (self) => {
          originalOnLeaveBack?.(self);
          stepObserver?.disable();
        }
      });

      // A page restored or opened inside the trigger does not necessarily fire
      // an entry callback during creation, so synchronize the observer once.
      if (mobileStageEffects && trigger.isActive) {
        stepObserver?.enable();
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

// Preserve continuous scrub motion inside a story while limiting only the
// excess portion of a strong wheel/touch gesture at meaningful scene starts.
// This is intentionally different from discrete step mode above: small input
// remains 1:1, and only an attempted boundary crossing is clamped.
export function createBoundaryLimitedScrollTrigger({ vars, boundaryPoints }) {
  let trigger = null;
  let touchIntentObserver = null;
  let touchObserver = null;
  let wheelObserver = null;
  let boundaryLocked = false;

  const points = prepareStepPoints([0, ...(boundaryPoints || []), 1]);
  const destroyInstances = () => {
    touchIntentObserver?.kill();
    touchIntentObserver = null;
    touchObserver?.kill();
    touchObserver = null;
    wheelObserver?.kill();
    wheelObserver = null;
    trigger?.kill();
    trigger = null;
  };

  const create = () => {
    destroyInstances();
    const mobileTouchEffects = shouldUseMobileStageEffects();
    const reducedMotion = reducedMotionInput.matches;
    const {
      onEnter: originalOnEnter,
      onEnterBack: originalOnEnterBack,
      onLeave: originalOnLeave,
      onLeaveBack: originalOnLeaveBack,
      ...triggerVars
    } = vars;

    const progressToScroll = (progress, controller = trigger) => (
      controller.start + ((controller.end - controller.start) * progress)
    );
    const getNextBoundary = (scrollPosition, direction) => {
      if (direction > 0 && scrollPosition < trigger.start) return trigger.start + 1;
      if (direction < 0 && scrollPosition > trigger.end) {
        const lastContentPoint = points.findLast((point) => point < 1) ?? 0;
        return progressToScroll(lastContentPoint);
      }
      const progress = clampProgress(trigger.progress);
      const epsilon = .001;
      const point = direction > 0
        ? points.find((candidate) => candidate > progress + epsilon)
        : points.findLast((candidate) => candidate < progress - epsilon);
      if (point === undefined) return direction > 0 ? trigger.end + 2 : trigger.start - 2;
      return progressToScroll(point);
    };
    const applyLimitedDelta = (delta) => {
      if (!trigger || !delta || boundaryLocked) return;
      const current = trigger.scroll();
      const direction = delta > 0 ? 1 : -1;
      const boundary = getNextBoundary(current, direction);
      const proposed = current + delta;
      const crossesBoundary = direction > 0 ? proposed >= boundary : proposed <= boundary;
      trigger.scroll(crossesBoundary ? boundary : proposed);
      if (crossesBoundary) boundaryLocked = true;
    };
    const wheelDeltaPixels = (event) => event.deltaY * (
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
    );
    const wheelIntersectsRange = (event) => {
      if (!trigger || event.ctrlKey) return false;
      const current = trigger.scroll();
      const projected = current + wheelDeltaPixels(event);
      return event.deltaY > 0
        ? current < trigger.end && projected >= trigger.start
        : current > trigger.start && projected <= trigger.end;
    };

    trigger = ScrollTrigger.create({
      ...triggerVars,
      onEnter: (self) => {
        originalOnEnter?.(self);
        if (!mobileTouchEffects) return;
        const activeEvent = touchIntentObserver?.isPressed ? touchIntentObserver.event : undefined;
        boundaryLocked = Boolean(activeEvent);
        touchObserver?.enable(activeEvent);
        if (activeEvent) self.scroll(self.start + 1);
      },
      onEnterBack: (self) => {
        originalOnEnterBack?.(self);
        if (!mobileTouchEffects) return;
        const activeEvent = touchIntentObserver?.isPressed ? touchIntentObserver.event : undefined;
        boundaryLocked = Boolean(activeEvent);
        touchObserver?.enable(activeEvent);
        if (activeEvent) {
          const lastContentPoint = points.findLast((point) => point < 1) ?? 0;
          self.scroll(progressToScroll(lastContentPoint, self));
        }
      },
      onLeave: (self) => {
        originalOnLeave?.(self);
        touchObserver?.disable();
      },
      onLeaveBack: (self) => {
        originalOnLeaveBack?.(self);
        touchObserver?.disable();
      }
    });

    if (reducedMotion) return;

    wheelObserver = ScrollTrigger.observe({
      target: window,
      type: "wheel",
      preventDefault: true,
      debounce: false,
      onStopDelay: .04,
      ignore: "a, button, input, textarea, select, [data-nav]",
      ignoreCheck: (event) => !wheelIntersectsRange(event),
      onWheel: (self) => applyLimitedDelta(self.deltaY),
      onStop: () => {
        boundaryLocked = false;
      }
    });

    if (mobileTouchEffects) {
      touchIntentObserver = ScrollTrigger.observe({ target: window, type: "touch" });
      touchObserver = ScrollTrigger.observe({
        target: window,
        type: "touch",
        preventDefault: true,
        allowClicks: true,
        lockAxis: true,
        dragMinimum: 4,
        tolerance: 2,
        ignore: "a, button, input, textarea, select, [data-nav]",
        onPress: () => {
          boundaryLocked = false;
        },
        // Touch delta follows the finger; page scrolling moves oppositely.
        onChangeY: (self) => applyLimitedDelta(-self.deltaY),
        onRelease: () => {
          boundaryLocked = false;
        }
      });
      touchObserver.disable();
      if (trigger.isActive) touchObserver?.enable();
    }
  };

  create();
  const unsubscribe = subscribeMobileScrollEffects(create);
  return () => {
    unsubscribe();
    destroyInstances();
  };
}
