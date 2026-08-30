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
  stepDuration = .32,
  backEntryPoint = null,
  forwardExitTarget = null
}) {
  let trigger = null;
  let touchIntentObserver = null;
  let panelObserver = null;
  let stepTween = null;
  let gestureRelease = null;
  let gestureConsumed = false;
  let savedScroll = 0;
  let restoringScroll = false;
  let frozenHash = "";

  const destroyInstances = () => {
    stepTween?.kill();
    stepTween = null;
    gestureRelease?.kill();
    gestureRelease = null;
    document.removeEventListener("scroll", restoreSavedScroll);
    restoringScroll = false;
    touchIntentObserver?.kill();
    touchIntentObserver = null;
    panelObserver?.kill();
    panelObserver = null;
    trigger?.kill();
    trigger = null;
  };

  // GSAP's official Observer panel demo freezes the window at the saved
  // position while the panel transition runs. This extra scroll listener is
  // important on Mac trackpads and mobile Safari because native momentum may
  // continue changing scrollY after the wheel/touch event was prevented.
  function restoreSavedScroll() {
    if (!restoringScroll || !trigger) return;
    // Anchor navigation is an explicit request to leave the panel story. Do
    // not let the momentum guard fight the browser's new hash destination.
    if (location.hash !== frozenHash) {
      panelObserver?.disable();
      return;
    }
    if (Math.abs(trigger.scroll() - savedScroll) > .5) trigger.scroll(savedScroll);
  }

  const startRestoringScroll = () => {
    if (restoringScroll) return;
    restoringScroll = true;
    frozenHash = location.hash;
    document.addEventListener("scroll", restoreSavedScroll, { passive: false });
  };

  const stopRestoringScroll = () => {
    restoringScroll = false;
    document.removeEventListener("scroll", restoreSavedScroll);
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
      gestureRelease = gsap.delayedCall(.25, () => {
        gestureConsumed = false;
      }).pause();
      // This passive Observer remembers a touch that began before the sticky
      // range. Passing that same event to enable() lets the panel Observer take
      // over the entry gesture instead of waiting for a second finger press.
      if (mobileStageEffects) {
        touchIntentObserver = ScrollTrigger.observe({
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
          onUpdate: () => {
            // Update the frozen position before writing scrollY so the
            // momentum-restoration listener accepts this GSAP-owned movement.
            savedScroll = scrollState.position;
            controller.scroll(scrollState.position);
          },
          onComplete: () => {
            stepTween = null;
            onComplete?.();
          }
        });
      };

      const getForwardExitScroll = () => {
        const requestedTarget = typeof forwardExitTarget === "function"
          ? forwardExitTarget(trigger)
          : forwardExitTarget;
        return Number.isFinite(requestedTarget) ? requestedTarget : trigger.end + 2;
      };

      const moveOneStep = (direction) => {
        if (!trigger) return;
        // Match the official panel pattern: while a transition is running,
        // consume extra momentum instead of queueing it as another panel move.
        if (stepTween?.isActive()) return;
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

        if (direction > 0) {
          // The timeline's final state may be an exit transition rather than a
          // panel that deserves its own stop. The same gesture that follows the
          // last visible panel therefore finishes that transition and carries
          // the viewport to the caller's next-section target. This prevents an
          // empty sticky viewport from becoming an accidental extra panel.
          tweenToScroll(getForwardExitScroll(), stepDuration, trigger, () => {
            panelObserver?.disable();
            stopRestoringScroll();
          });
          return;
        }

        // Reverse exit has no hidden transition: leave just above the range so
        // ScrollTrigger cannot immediately re-enter on the same tick.
        panelObserver?.disable();
        stopRestoringScroll();
        trigger.scroll(trigger.start - 2);
      };

      const consumeGesture = (direction) => {
        // Trackpads and touch gestures emit many callbacks. One physical input
        // is allowed to select exactly one panel; the rest of its momentum is
        // prevented and restored to the GSAP-owned scroll position.
        if (gestureConsumed || stepTween?.isActive()) return;
        gestureConsumed = true;
        moveOneStep(direction);
      };

      panelObserver = ScrollTrigger.observe({
        target: window,
        type: mobileStageEffects ? "wheel,touch" : "wheel",
        preventDefault: true,
        allowClicks: true,
        lockAxis: true,
        dragMinimum: 8,
        tolerance: 10,
        // Invert wheel only so wheel-down and finger-up both mean "next".
        wheelSpeed: -1,
        onStopDelay: .25,
        ignore: "a, button, input, textarea, select, [data-nav]",
        onEnable: () => startRestoringScroll(),
        onDisable: () => stopRestoringScroll(),
        onPress: (self) => {
          // A new press is a new gesture. If the previous panel is still
          // settling, consume this press rather than queueing a later move.
          gestureConsumed = Boolean(stepTween?.isActive());
          gestureRelease?.pause();
          // Observer intentionally does not cancel touchstart by default. iOS
          // needs this explicit cancellation to prevent native momentum from
          // being created underneath the panel interaction.
          if (ScrollTrigger.isTouch && self.event.cancelable) self.event.preventDefault();
        },
        onUp: () => consumeGesture(1),
        onDown: () => consumeGesture(-1),
        onChange: () => {
          // If momentum keeps producing deltas, keep extending the gesture's
          // quiet window. This avoids both the old 40ms multi-skip bug and the
          // official demo's fixed one-second input cooldown.
          if (gestureConsumed) gestureRelease?.restart(true);
        },
        onStop: () => {
          // GSAP's default 250ms quiet window represents the end of a wheel
          // stream. It is long enough to absorb a trackpad momentum tail but
          // has no arbitrary one-second cooldown between deliberate gestures.
          if (!panelObserver?.isPressed) {
            gestureConsumed = false;
            gestureRelease?.pause();
          }
        }
      });
      panelObserver.disable();

      const enterStepRange = (self, entryPoint) => {
        const activeTouchEvent = touchIntentObserver?.isPressed
          ? touchIntentObserver.event
          : undefined;
        const entryScroll = progressToScroll(entryPoint, self);
        savedScroll = entryScroll;
        self.scroll(entryScroll);
        panelObserver?.enable(activeTouchEvent);
        // Entering the section already consumes the gesture. Its remaining
        // momentum is discarded so it cannot reveal a second panel as well.
        gestureConsumed = true;
        gestureRelease?.restart(true);
      };

      trigger = ScrollTrigger.create({
        ...triggerVars,
        onEnter: (self) => {
          originalOnEnter?.(self);
          enterStepRange(self, stepPoints[0]);
        },
        onEnterBack: (self) => {
          originalOnEnterBack?.(self);
          // A transition-only final state may be blank (the concerns collapse
          // before the following brand section). Callers can nominate the last
          // actual content panel for reverse entry instead of showing a blank.
          enterStepRange(
            self,
            backEntryPoint === null ? stepPoints.at(-1) : backEntryPoint
          );
        },
        onLeave: (self) => {
          originalOnLeave?.(self);
          // A GSAP-owned forward exit deliberately continues past `end` until
          // the following section reaches the viewport. Keep momentum blocked
          // until that short tween completes; normal native exits still release
          // the Observer immediately.
          if (!stepTween?.isActive()) panelObserver?.disable();
        },
        onLeaveBack: (self) => {
          originalOnLeaveBack?.(self);
          panelObserver?.disable();
        }
      });

      // A page restored or opened inside the trigger does not necessarily fire
      // an entry callback during creation, so synchronize the observer once.
      if (trigger.isActive) {
        savedScroll = trigger.scroll();
        gestureConsumed = false;
        panelObserver?.enable();
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
  let heldScroll = null;
  let restoringBoundary = false;
  let heldHash = "";

  const points = prepareStepPoints([0, ...(boundaryPoints || []), 1]);
  const destroyInstances = () => {
    releaseBoundary();
    touchIntentObserver?.kill();
    touchIntentObserver = null;
    touchObserver?.kill();
    touchObserver = null;
    wheelObserver?.kill();
    wheelObserver = null;
    trigger?.kill();
    trigger = null;
  };

  // A prevented wheel/touch event does not always cancel momentum that the
  // browser already scheduled. While a boundary is consumed, continuously
  // restore the exact clamped position, mirroring GSAP's official Observer
  // panel demo workaround for Mac trackpads and mobile native momentum.
  function restoreBoundary() {
    if (!boundaryLocked || !trigger || heldScroll === null) return;
    if (location.hash !== heldHash) {
      releaseBoundary();
      touchObserver?.disable();
      return;
    }
    if (Math.abs(trigger.scroll() - heldScroll) > .5) trigger.scroll(heldScroll);
  }

  function lockBoundary(position) {
    heldScroll = position;
    heldHash = location.hash;
    boundaryLocked = true;
    trigger.scroll(position);
    if (restoringBoundary) return;
    restoringBoundary = true;
    document.addEventListener("scroll", restoreBoundary, { passive: false });
  }

  function releaseBoundary() {
    boundaryLocked = false;
    heldScroll = null;
    restoringBoundary = false;
    document.removeEventListener("scroll", restoreBoundary);
  }

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
      if (direction > 0 && scrollPosition < trigger.start) {
        return { position: trigger.start + 1, exitsRange: false };
      }
      if (direction < 0 && scrollPosition > trigger.end) {
        const lastContentPoint = points.findLast((point) => point < 1) ?? 0;
        return { position: progressToScroll(lastContentPoint), exitsRange: false };
      }
      const progress = clampProgress(trigger.progress);
      const epsilon = .001;
      const point = direction > 0
        ? points.find((candidate) => candidate > progress + epsilon)
        : points.findLast((candidate) => candidate < progress - epsilon);
      if (point === undefined) {
        return {
          position: direction > 0 ? trigger.end + 2 : trigger.start - 2,
          exitsRange: true
        };
      }
      return { position: progressToScroll(point), exitsRange: false };
    };
    const applyLimitedDelta = (delta) => {
      if (!trigger || !delta) return;
      if (boundaryLocked) {
        restoreBoundary();
        return;
      }
      const current = trigger.scroll();
      const direction = delta > 0 ? 1 : -1;
      const { position: boundary, exitsRange } = getNextBoundary(current, direction);
      const proposed = current + delta;
      const crossesBoundary = direction > 0 ? proposed >= boundary : proposed <= boundary;
      if (!crossesBoundary) {
        trigger.scroll(proposed);
        return;
      }
      if (exitsRange) {
        // Reaching an exit is allowed only on the *next* physical gesture.
        // Once outside, relinquish touch control so the rest of the page stays
        // native; wheel control is already scoped by wheelIntersectsRange().
        trigger.scroll(boundary);
        touchObserver?.disable();
        return;
      }
      lockBoundary(boundary);
    };
    const wheelDeltaPixels = (event) => event.deltaY * (
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
    );
    const wheelIntersectsRange = (event) => {
      if (!trigger || event.ctrlKey) return false;
      // Continue cancelling every packet in the same momentum stream even if
      // the clamped boundary is exactly trigger.end/trigger.start.
      if (boundaryLocked) return true;
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
        if (reducedMotion) return;
        const activeEvent = mobileTouchEffects && touchIntentObserver?.isPressed
          ? touchIntentObserver.event
          : undefined;
        touchObserver?.enable(activeEvent);
        if (activeEvent?.cancelable) activeEvent.preventDefault();
        // Entry itself is a meaningful boundary on every input device. Clamp
        // even when an async native scroll update has already painted slightly
        // inside the section, otherwise the first scene can be skipped before
        // Observer receives the crossing wheel/touch packet.
        if (!boundaryLocked) lockBoundary(self.start + 1);
      },
      onEnterBack: (self) => {
        originalOnEnterBack?.(self);
        if (reducedMotion) return;
        const activeEvent = mobileTouchEffects && touchIntentObserver?.isPressed
          ? touchIntentObserver.event
          : undefined;
        touchObserver?.enable(activeEvent);
        if (activeEvent?.cancelable) activeEvent.preventDefault();
        if (!boundaryLocked) {
          const lastContentPoint = points.findLast((point) => point < 1) ?? 0;
          lockBoundary(progressToScroll(lastContentPoint, self));
        }
      },
      onLeave: (self) => {
        originalOnLeave?.(self);
        if (!boundaryLocked) touchObserver?.disable();
      },
      onLeaveBack: (self) => {
        originalOnLeaveBack?.(self);
        if (!boundaryLocked) touchObserver?.disable();
      }
    });

    if (reducedMotion) return;

    wheelObserver = ScrollTrigger.observe({
      target: window,
      type: "wheel",
      preventDefault: true,
      debounce: false,
      // GSAP's documented default is 250ms. A 40ms gap splits one trackpad
      // fling into several gestures, allowing it to cross every scene.
      onStopDelay: .25,
      ignore: "a, button, input, textarea, select, [data-nav]",
      ignoreCheck: (event) => !wheelIntersectsRange(event),
      onWheel: (self) => applyLimitedDelta(self.deltaY),
      onStop: () => {
        releaseBoundary();
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
        onPress: (self) => {
          // Only a fresh press releases a boundary consumed by the preceding
          // swipe. This is what makes "one physical gesture, one boundary"
          // reliable even though touch momentum outlives touchend on iOS.
          releaseBoundary();
          if (ScrollTrigger.isTouch && self.event.cancelable) self.event.preventDefault();
        },
        // Touch delta follows the finger; page scrolling moves oppositely.
        onChangeY: (self) => applyLimitedDelta(-self.deltaY),
        // Do not unlock onRelease: releasing the finger starts the browser's
        // kinetic tail. The next onPress is the next deliberate gesture.
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
