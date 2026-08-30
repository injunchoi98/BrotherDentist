import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const mobileTouchInput = matchMedia("(max-width: 48rem) and (any-pointer: coarse)");
const reducedMotionInput = matchMedia("(prefers-reduced-motion: reduce)");
const interactiveIgnore = "a, button, input, textarea, select, [data-nav]";
const clampProgress = gsap.utils.clamp(0, 1);

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

const prepareStepPoints = (points) => [
  ...new Set((points || []).map((point) => clampProgress(point)))
].sort((a, b) => a - b);

const getRequestedTarget = (requestedTarget, fallback) => {
  const target = typeof requestedTarget === "function"
    ? requestedTarget()
    : requestedTarget;
  return Number.isFinite(target) ? target : fallback;
};

const wheelDeltaPixels = (event) => event.deltaY * (
  event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
);

/**
 * DISCRETE STORY CONTRACT — concern/chat section only.
 *
 * 사용자 의도: 모바일에서 강한 스크롤 한 번으로 걱정 섹션 전체가
 * 지나가지 않게 한다. 말풍선은 한 번에 정확히 하나만 진행하고,
 * 세 번째 말풍선을 본 다음에 들어온 별도의 스와이프만 섹션을 나간다.
 *
 * Product intent:
 * - Each speech-bubble state is a complete panel, not meaningful continuous
 *   motion. One deliberate swipe may reveal at most one panel.
 * - A strong fling must never consume every bubble or the whole section.
 * - After the last bubble is already resting, one additional gesture may exit.
 *
 * Mobile therefore freezes document scroll while the story is active and
 * tweens the supplied timeline DIRECTLY between settled stage points. Do not
 * replace this with scrollY -> scrub -> animation indirection: that old design
 * made every reveal wait for a synthetic page-scroll tween and felt sluggish.
 *
 * This controller must not be reused for the showcase section. Showcase motion
 * between scene titles contains real information and needs continuous progress;
 * it uses createBoundaryLimitedScrollTrigger() below.
 */
export function createResponsiveStageScrollTrigger({
  vars,
  mobileStepPoints = null,
  observeDesktopWheel = false,
  stepDuration = .3,
  backEntryPoint = null,
  forwardExitTarget = null
}) {
  let trigger = null;
  let touchIntentObserver = null;
  let touchStageObserver = null;
  let wheelObserver = null;
  let stageTween = null;
  let scrollTween = null;
  let frozenScroll = null;
  let frozenHash = "";
  let currentStageIndex = 0;
  let gestureConsumed = false;
  let exiting = false;

  function restoreFrozenScroll() {
    if (frozenScroll === null || !trigger) return;
    if (location.hash !== frozenHash) {
      touchStageObserver?.disable();
      releaseFrozenScroll();
      return;
    }
    if (Math.abs(trigger.scroll() - frozenScroll) > .5) {
      trigger.scroll(frozenScroll);
    }
  }

  function freezeDocumentAt(position) {
    frozenScroll = position;
    frozenHash = location.hash;
    trigger?.scroll(position);
    document.removeEventListener("scroll", restoreFrozenScroll);
    document.addEventListener("scroll", restoreFrozenScroll, { passive: false });
  }

  function releaseFrozenScroll() {
    frozenScroll = null;
    document.removeEventListener("scroll", restoreFrozenScroll);
  }

  const destroyInstances = () => {
    stageTween?.kill();
    stageTween = null;
    scrollTween?.kill();
    scrollTween = null;
    releaseFrozenScroll();
    touchIntentObserver?.kill();
    touchIntentObserver = null;
    touchStageObserver?.kill();
    touchStageObserver = null;
    wheelObserver?.kill();
    wheelObserver = null;
    trigger?.kill();
    trigger = null;
    exiting = false;
  };

  const create = () => {
    destroyInstances();

    const mobileStageEffects = shouldUseMobileStageEffects();
    const desktopWheelEffects = observeDesktopWheel
      && !mobileTouchInput.matches
      && !reducedMotionInput.matches;
    const stepPoints = (mobileStageEffects || desktopWheelEffects)
      && Array.isArray(mobileStepPoints)
      ? prepareStepPoints(mobileStepPoints)
      : [];

    if (!stepPoints.length) {
      trigger = ScrollTrigger.create(vars);
      return;
    }

    const {
      onEnter: originalOnEnter,
      onEnterBack: originalOnEnterBack,
      onLeave: originalOnLeave,
      onLeaveBack: originalOnLeaveBack,
      ...triggerVars
    } = vars;

    const progressToScroll = (progress, controller = trigger) => {
      const range = controller.end - controller.start;
      const boundaryInset = progress === 0 ? 1 : progress === 1 ? -1 : 0;
      return controller.start + (range * progress) + boundaryInset;
    };

    const tweenDocumentTo = (position, duration = stepDuration, onComplete = null) => {
      scrollTween?.kill();
      const state = { position: trigger.scroll() };
      scrollTween = gsap.to(state, {
        position,
        duration,
        ease: "power2.out",
        overwrite: true,
        onUpdate: () => {
          // Exit movement is GSAP-owned, so advance the frozen coordinate before
          // setting scrollY. The momentum guard then accepts this movement.
          frozenScroll = state.position;
          trigger.scroll(state.position);
        },
        onComplete: () => {
          scrollTween = null;
          onComplete?.();
        }
      });
    };

    if (mobileStageEffects) {
      const {
        animation,
        // Mobile panels are Observer-controlled. Keeping scrub here would make
        // the same animation answer to both scrollY and the stage controller.
        scrub: _scrub,
        snap: _snap,
        ...mobileTriggerVars
      } = triggerVars;

      if (!animation) {
        trigger = ScrollTrigger.create(vars);
        return;
      }

      animation.pause();

      const setStage = (index, animate = true) => {
        const nextIndex = gsap.utils.clamp(0, stepPoints.length - 1, index);
        currentStageIndex = nextIndex;
        stageTween?.kill();
        if (!animate) {
          animation.progress(stepPoints[nextIndex]).pause();
          return;
        }
        stageTween = gsap.to(animation, {
          progress: stepPoints[nextIndex],
          duration: stepDuration,
          ease: "power2.out",
          overwrite: true,
          onComplete: () => {
            stageTween = null;
          }
        });
      };

      const finishForwardStory = () => {
        if (exiting) return;
        exiting = true;
        stageTween?.kill();

        // The concern collapse and movement into the brand section deliberately
        // run together. This preserves the existing natural exit that the user
        // explicitly identified as correct, while internal bubbles no longer
        // move document scroll at all.
        stageTween = gsap.to(animation, {
          progress: 1,
          duration: stepDuration,
          ease: "power3.inOut",
          overwrite: true
        });
        tweenDocumentTo(
          getRequestedTarget(
            forwardExitTarget,
            trigger.end + document.documentElement.clientHeight
          ),
          stepDuration,
          () => {
            touchStageObserver?.disable();
            releaseFrozenScroll();
            stageTween = null;
            exiting = false;
          }
        );
      };

      const moveOneStage = (direction) => {
        if (exiting || stageTween?.isActive() || scrollTween?.isActive()) return;
        const nextIndex = currentStageIndex + direction;
        if (nextIndex >= 0 && nextIndex < stepPoints.length) {
          setStage(nextIndex);
          return;
        }
        if (direction > 0) {
          finishForwardStory();
          return;
        }

        // Reverse exit has no hidden panel transition. Release the input guard
        // and move just outside the trigger so the previous page stays native.
        touchStageObserver?.disable();
        releaseFrozenScroll();
        trigger.scroll(trigger.start - 2);
      };

      const consumeGesture = (direction) => {
        // Observer can emit several direction callbacks during one finger press.
        // The latch resets only on the next physical press; momentum or a pause
        // inside the same swipe can never reveal a second bubble.
        if (gestureConsumed) return;
        gestureConsumed = true;
        moveOneStage(direction);
      };

      touchIntentObserver = ScrollTrigger.observe({
        target: window,
        type: "touch"
      });
      touchStageObserver = ScrollTrigger.observe({
        target: window,
        type: "touch",
        preventDefault: true,
        allowClicks: true,
        lockAxis: true,
        dragMinimum: 8,
        tolerance: 14,
        ignore: interactiveIgnore,
        onPress: (self) => {
          gestureConsumed = Boolean(
            exiting || stageTween?.isActive() || scrollTween?.isActive()
          );
          // Observer intentionally does not cancel touchstart automatically.
          // iOS needs this explicit call or native kinetic scrolling may be
          // created underneath the discrete panel gesture.
          if (self.event.cancelable) self.event.preventDefault();
        },
        onUp: () => consumeGesture(1),
        onDown: () => consumeGesture(-1)
      });
      touchStageObserver.disable();

      const enterMobileStory = (self, stageIndex, scrollPosition) => {
        const activeEvent = touchIntentObserver?.isPressed
          ? touchIntentObserver.event
          : undefined;
        setStage(stageIndex, false);
        freezeDocumentAt(scrollPosition);
        touchStageObserver?.enable(activeEvent);
        // The gesture that entered the section counts only as entry. Its
        // remaining velocity must not reveal the first-to-second transition.
        gestureConsumed = Boolean(activeEvent);
      };

      trigger = ScrollTrigger.create({
        ...mobileTriggerVars,
        onEnter: (self) => {
          originalOnEnter?.(self);
          enterMobileStory(self, 0, self.start + 1);
        },
        onEnterBack: (self) => {
          originalOnEnterBack?.(self);
          const requestedIndex = backEntryPoint === null
            ? stepPoints.length - 1
            : stepPoints.reduce((best, point, index) => (
              Math.abs(point - backEntryPoint) < Math.abs(stepPoints[best] - backEntryPoint)
                ? index
                : best
            ), 0);
          enterMobileStory(self, requestedIndex, self.end - 1);
        },
        onLeave: (self) => {
          originalOnLeave?.(self);
          if (!scrollTween?.isActive()) {
            touchStageObserver?.disable();
            releaseFrozenScroll();
          }
        },
        onLeaveBack: (self) => {
          originalOnLeaveBack?.(self);
          touchStageObserver?.disable();
          releaseFrozenScroll();
        }
      });

      if (trigger.isActive) {
        currentStageIndex = stepPoints.reduce((best, point, index) => (
          Math.abs(point - trigger.progress) < Math.abs(stepPoints[best] - trigger.progress)
            ? index
            : best
        ), 0);
        setStage(currentStageIndex, false);
        freezeDocumentAt(trigger.scroll());
        touchStageObserver.enable();
      }
      return;
    }

    // Desktop keeps the established scroll-linked timeline. The wheel Observer
    // only prevents one high-energy wheel/trackpad stream from crossing several
    // settled stages before ScrollTrigger can render them.
    trigger = ScrollTrigger.create({
      ...triggerVars,
      onEnter: originalOnEnter,
      onEnterBack: originalOnEnterBack,
      onLeave: originalOnLeave,
      onLeaveBack: originalOnLeaveBack
    });

    if (!desktopWheelEffects) return;

    let wheelGestureConsumed = false;
    const moveDesktopOneStage = (direction) => {
      if (!trigger || scrollTween?.isActive()) return;
      const progress = clampProgress(trigger.progress);
      const epsilon = .001;
      const point = direction > 0
        ? stepPoints.find((candidate) => candidate > progress + epsilon)
        : stepPoints.findLast((candidate) => candidate < progress - epsilon);
      if (point !== undefined) {
        tweenDocumentTo(progressToScroll(point));
        return;
      }
      const fallback = direction > 0 ? trigger.end + 2 : trigger.start - 2;
      const target = direction > 0
        ? getRequestedTarget(forwardExitTarget, fallback)
        : fallback;
      tweenDocumentTo(target);
    };
    const wheelIntersectsRange = (event) => {
      if (!trigger || event.ctrlKey) return false;
      const current = trigger.scroll();
      const projected = current + wheelDeltaPixels(event);
      return event.deltaY > 0
        ? current < trigger.end && projected >= trigger.start
        : current > trigger.start && projected <= trigger.end;
    };
    wheelObserver = ScrollTrigger.observe({
      target: window,
      type: "wheel",
      preventDefault: true,
      debounce: false,
      onStopDelay: .25,
      ignore: interactiveIgnore,
      ignoreCheck: (event) => !wheelIntersectsRange(event),
      onWheel: (self) => {
        if (wheelGestureConsumed) return;
        wheelGestureConsumed = true;
        moveDesktopOneStage(self.deltaY > 0 ? 1 : -1);
      },
      onStop: () => {
        wheelGestureConsumed = false;
      }
    });
  };

  create();
  const unsubscribe = subscribeMobileScrollEffects(create);
  return () => {
    unsubscribe();
    destroyInstances();
  };
}

/**
 * CONTINUOUS STORY CONTRACT — showcase section only.
 *
 * 사용자 의도: 이 섹션은 장면 사이의 사진·문자·지도 움직임 자체가
 * 콘텐츠이므로 손가락 이동을 연속 진행률로 보여준다. 단, 강한 스와이프
 * 하나가 여러 의미 지점이나 섹션 끝을 한꺼번에 넘지는 못한다. 마지막
 * 장면에 도착한 스와이프와 다음 섹션으로 나가는 스와이프는 반드시 다르다.
 *
 * Product intent:
 * - Motion between titles is meaningful content. Finger travel must scrub that
 *   motion continuously; a swipe must NOT jump directly to the next title.
 * - A strong gesture may travel no farther than the immediately adjacent scene
 *   boundary. Its remaining momentum is discarded at that boundary.
 * - Reaching the final scene and leaving the whole section require two separate
 *   gestures. The gesture that reaches the final scene can never also exit.
 *
 * This is deliberately not the discrete concern controller above. Sharing the
 * two behaviors would either skip showcase motion or make concern bubbles crawl.
 */
export function createBoundaryLimitedScrollTrigger({
  vars,
  boundaryPoints,
  forwardExitTarget = null
}) {
  let trigger = null;
  let touchIntentObserver = null;
  let touchObserver = null;
  let wheelObserver = null;
  let exitTween = null;
  let boundaryLocked = false;
  let heldScroll = null;
  let heldHash = "";
  let gestureStartScroll = 0;
  let gestureBoundaryScroll = null;
  let gestureDirection = 0;
  let gestureExiting = false;
  let nativeBoundaryGuard = null;

  const points = prepareStepPoints([0, ...(boundaryPoints || []), 1]);

  function restoreBoundary() {
    if (!boundaryLocked || heldScroll === null || !trigger) return;
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
    document.removeEventListener("scroll", restoreBoundary);
    document.addEventListener("scroll", restoreBoundary, { passive: false });
  }

  function releaseBoundary() {
    boundaryLocked = false;
    heldScroll = null;
    document.removeEventListener("scroll", restoreBoundary);
  }

  const destroyInstances = () => {
    exitTween?.kill();
    exitTween = null;
    if (nativeBoundaryGuard) {
      document.removeEventListener("scroll", nativeBoundaryGuard);
      nativeBoundaryGuard = null;
    }
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

    const progressToScroll = (progress, controller = trigger) => {
      const inset = progress === 0 ? 1 : progress === 1 ? -1 : 0;
      return controller.start + ((controller.end - controller.start) * progress) + inset;
    };
    const scrollToProgress = (position, controller = trigger) => clampProgress(
      (position - controller.start) / Math.max(1, controller.end - controller.start)
    );
    const getAdjacentPoint = (progress, direction) => {
      const epsilon = .0015;
      return direction > 0
        ? points.find((point) => point > progress + epsilon)
        : points.findLast((point) => point < progress - epsilon);
    };

    const exitContinuousStory = (direction) => {
      if (gestureExiting || exitTween?.isActive()) return;
      gestureExiting = true;
      releaseBoundary();
      touchObserver?.disable();
      const fallback = direction > 0 ? trigger.end + 2 : trigger.start - 2;
      const target = direction > 0
        ? getRequestedTarget(forwardExitTarget, fallback)
        : fallback;
      const state = { position: trigger.scroll() };
      exitTween = gsap.to(state, {
        position: target,
        duration: .38,
        ease: "power2.out",
        overwrite: true,
        onUpdate: () => {
          trigger.scroll(state.position);
          ScrollTrigger.update();
        },
        onComplete: () => {
          exitTween = null;
          gestureExiting = false;
        }
      });
    };

    const beginGestureDirection = (direction) => {
      gestureDirection = direction;
      const progress = scrollToProgress(gestureStartScroll);
      const point = getAdjacentPoint(progress, direction);
      if (point === undefined) {
        exitContinuousStory(direction);
        return false;
      }
      gestureBoundaryScroll = progressToScroll(point);
      return true;
    };

    nativeBoundaryGuard = () => {
      if (
        !trigger
        || boundaryLocked
        || gestureExiting
        || !gestureDirection
        || gestureBoundaryScroll === null
      ) return;

      const current = trigger.scroll();
      const crossedBoundary = gestureDirection > 0
        ? current >= gestureBoundaryScroll
        : current <= gestureBoundaryScroll;
      if (!crossedBoundary) return;

      /*
       * Mobile showcase rule:
       * - Inside the current scene interval, do nothing. The browser owns the
       *   scroll and ScrollTrigger's scrub follows that native position.
       * - Only when this physical gesture (including its kinetic tail) crosses
       *   the adjacent scene boundary do we write scrollY once and hold there.
       * - The next touchstart releases the hold, so one gesture cannot consume
       *   several scene boundaries or reach the next page section.
       *
       * Do not restore the old `trigger.scroll(current + delta)` loop here.
       * That required preventDefault on every touchmove and replaced native
       * mobile scrolling with a frame-by-frame JavaScript approximation.
      */
      lockBoundary(gestureBoundaryScroll);
    };

    const trackTouchDirection = (delta) => {
      if (!trigger || !delta || boundaryLocked || gestureExiting) return;
      if (!gestureDirection) {
        beginGestureDirection(delta > 0 ? 1 : -1);
      }
      // Native scrolling may already have advanced between the raw touchmove
      // and Observer's rAF callback. Check immediately as well as on scroll.
      nativeBoundaryGuard?.();
    };

    if (mobileTouchEffects) {
      const {
        // Numeric scrub deliberately lags behind the browser's real position.
        // Mobile now keeps native scrolling, so direct scrub must render the
        // meaningful intermediate frame under the finger without catch-up.
        scrub: _scrub,
        snap: _snap,
        ...mobileTriggerVars
      } = triggerVars;

      touchIntentObserver = ScrollTrigger.observe({ target: window, type: "touch" });
      touchObserver = ScrollTrigger.observe({
        target: window,
        type: "touch",
        allowClicks: true,
        lockAxis: true,
        dragMinimum: 4,
        tolerance: 2,
        ignore: interactiveIgnore,
        onPress: () => {
          releaseBoundary();
          gestureStartScroll = trigger.scroll();
          gestureBoundaryScroll = null;
          gestureDirection = 0;
          gestureExiting = false;
        },
        // Observe direction only. Native scroll performs the actual movement.
        onChangeY: (self) => trackTouchDirection(-self.deltaY)
      });
      touchObserver.disable();
      document.addEventListener("scroll", nativeBoundaryGuard, { passive: true });

      const enterContinuousStory = (self, progress, activeEvent) => {
        const entryScroll = progressToScroll(progress, self);
        self.scroll(entryScroll);
        touchObserver.enable(activeEvent);
        // Enabling with the touch that crossed into the section invokes
        // onPress. Lock *after* enable so that onPress cannot release the entry
        // boundary and let the same gesture's native momentum enter scene 1.
        lockBoundary(entryScroll);
        // The gesture that crossed into the story is spent on entry. The next
        // fresh press releases this gate and begins continuous scene scrubbing.
        gestureStartScroll = entryScroll;
        gestureBoundaryScroll = null;
        gestureDirection = 0;
      };

      trigger = ScrollTrigger.create({
        ...mobileTriggerVars,
        scrub: true,
        onEnter: (self) => {
          originalOnEnter?.(self);
          const activeEvent = touchIntentObserver?.isPressed
            ? touchIntentObserver.event
            : undefined;
          enterContinuousStory(self, 0, activeEvent);
        },
        onEnterBack: (self) => {
          originalOnEnterBack?.(self);
          const activeEvent = touchIntentObserver?.isPressed
            ? touchIntentObserver.event
            : undefined;
          enterContinuousStory(self, 1, activeEvent);
        },
        onLeave: (self) => {
          originalOnLeave?.(self);
          if (!exitTween?.isActive()) {
            touchObserver.disable();
            releaseBoundary();
          }
        },
        onLeaveBack: (self) => {
          originalOnLeaveBack?.(self);
          touchObserver.disable();
          releaseBoundary();
        }
      });

      if (trigger.isActive) {
        lockBoundary(trigger.scroll());
        touchObserver.enable();
      }
    } else {
      trigger = ScrollTrigger.create({
        ...triggerVars,
        onEnter: originalOnEnter,
        onEnterBack: originalOnEnterBack,
        onLeave: originalOnLeave,
        onLeaveBack: originalOnLeaveBack
      });
    }

    if (reducedMotion || mobileTouchEffects) return;

    // Desktop wheel/trackpad keeps continuous scrub too, but a single momentum
    // stream is clamped at the next scene boundary until the stream goes quiet.
    const wheelIntersectsRange = (event) => {
      if (!trigger || event.ctrlKey) return false;
      if (boundaryLocked) return true;
      const current = trigger.scroll();
      const projected = current + wheelDeltaPixels(event);
      return event.deltaY > 0
        ? current < trigger.end && projected >= trigger.start
        : current > trigger.start && projected <= trigger.end;
    };
    const applyWheelDelta = (delta) => {
      if (!trigger || !delta || boundaryLocked) return;
      const direction = delta > 0 ? 1 : -1;
      const point = getAdjacentPoint(trigger.progress, direction);
      if (point === undefined) {
        trigger.scroll(direction > 0 ? trigger.end + 2 : trigger.start - 2);
        return;
      }
      const boundary = progressToScroll(point);
      const proposed = trigger.scroll() + delta;
      const crossed = direction > 0 ? proposed >= boundary : proposed <= boundary;
      trigger.scroll(crossed ? boundary : proposed);
      if (crossed) lockBoundary(boundary);
    };
    wheelObserver = ScrollTrigger.observe({
      target: window,
      type: "wheel",
      preventDefault: true,
      debounce: false,
      onStopDelay: .25,
      ignore: interactiveIgnore,
      ignoreCheck: (event) => !wheelIntersectsRange(event),
      onWheel: (self) => applyWheelDelta(self.deltaY),
      onStop: releaseBoundary
    });
  };

  create();
  const unsubscribe = subscribeMobileScrollEffects(create);
  return () => {
    unsubscribe();
    destroyInstances();
  };
}
