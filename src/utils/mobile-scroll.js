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

const wheelDeltaPixels = (event) => event.deltaY * (
  event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
);

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
 * - Once a gesture starts on the first/final scene and points out of the story,
 *   it exits natively without another artificial edge guard or scroll tween.
 *
 * This is deliberately separate from discrete-stage-scroll.js. Sharing the two
 * behaviors would either skip showcase motion or make concern bubbles crawl.
 */
export function createBoundaryLimitedScrollTrigger({
  vars,
  boundaryPoints
}) {
  let trigger = null;
  let touchIntentObserver = null;
  let touchObserver = null;
  let wheelObserver = null;
  let boundaryLocked = false;
  let heldScroll = null;
  let heldHash = "";
  let gestureStartScroll = 0;
  let gestureBoundaryScroll = null;
  let gestureDirection = 0;
  let gestureExiting = false;
  let nativeBoundaryGuard = null;

  const points = prepareStepPoints([0, ...(boundaryPoints || []), 1]);
  const boundaryEpsilon = .0015;
  const firstSceneEnd = points[1] ?? 1;
  const lastSceneStart = points.at(-2) ?? 0;

  function restoreBoundary() {
    if (!boundaryLocked || heldScroll === null || !trigger) return;
    if (location.hash !== heldHash) {
      releaseBoundary();
      touchObserver?.disable();
      return;
    }
    if (Math.abs(trigger.scroll() - heldScroll) > .5) trigger.scroll(heldScroll);
  }

  function lockBoundary(position, controller = trigger) {
    heldScroll = position;
    heldHash = location.hash;
    boundaryLocked = true;
    controller.scroll(position);
    document.removeEventListener("scroll", restoreBoundary);
    document.addEventListener("scroll", restoreBoundary, { passive: false });
  }

  function releaseBoundary() {
    boundaryLocked = false;
    heldScroll = null;
    document.removeEventListener("scroll", restoreBoundary);
  }

  const destroyInstances = () => {
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
    gestureExiting = false;
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
      return direction > 0
        ? points.find((point) => point > progress + boundaryEpsilon)
        : points.findLast((point) => point < progress - boundaryEpsilon);
    };

    const isOuterSceneExit = (progress, direction) => {
      /*
       * 사용자 의도: 첫 장면과 마지막 장면은 섹션의 출구 전체다.
       * 정확히 progress 0/1에 서 있을 때만 출구로 보지 않는다.
       *
       * - 첫 장면 안에서 위로 향하면 앞 섹션으로 자연스럽게 나간다.
       * - 마지막 장면 안에서 아래로 향하면 다음 섹션으로 자연스럽게 나간다.
       * - 중간 장면 및 바깥 장면의 안쪽 방향에만 한 경계 가드를 둔다.
       *
       * Previously, a small inward move made 0 or 1 look like an adjacent
       * boundary. The outward gesture was then spent returning to that exact
       * point, where restoreBoundary fought native momentum and visibly
       * rattled. Scene-range exit detection must run before adjacent-boundary
       * selection so an outward edge gesture never installs that lock.
       */
      if (direction < 0) {
        return progress < firstSceneEnd - boundaryEpsilon;
      }
      return progress >= lastSceneStart - boundaryEpsilon;
    };

    const exitContinuousStory = () => {
      if (gestureExiting) return;
      gestureExiting = true;
      releaseBoundary();
      gestureBoundaryScroll = null;

      /*
       * The outer edges are exits, not additional story beats. A gesture that
       * STARTS on scene 1 and travels upward, or starts on the final scene and
       * travels downward, must remain browser-native. Do not tween to the
       * trigger start/end here: that synthetic movement competed with weak
       * touches and could leave the sticky section apparently trapped.
       *
       * Keep Observer enabled until onLeave/onLeaveBack. If this gesture is too
       * small to exit, the next physical press resets gestureExiting and
       * restores adjacent-boundary guarding inside the section.
       */
    };

    const beginGestureDirection = (direction) => {
      gestureDirection = direction;
      const progress = scrollToProgress(gestureStartScroll);
      if (isOuterSceneExit(progress, direction)) {
        exitContinuousStory();
        return false;
      }
      const point = getAdjacentPoint(progress, direction);
      if (point === undefined) {
        exitContinuousStory();
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
       *   scroll and the guarded visual progress follows that native position.
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
        animation,
        // Numeric scrub deliberately lags behind the browser's real position.
        // Mobile instead drives the animation from guarded visual progress in
        // onUpdate, while native scrolling remains the physical source.
        scrub: _scrub,
        snap: _snap,
        onUpdate: originalOnUpdate,
        ...mobileTriggerVars
      } = triggerVars;

      if (!animation) {
        trigger = ScrollTrigger.create(vars);
        return;
      }

      animation.pause();

      const getExactBoundaryProgress = (position, self) => {
        const measuredProgress = scrollToProgress(position, self);
        const knownPoint = points.find(
          (point) => Math.abs(point - measuredProgress) <= .0015
        );
        return knownPoint ?? measuredProgress;
      };

      const getGuardedVisualProgress = (self) => {
        const nativeProgress = clampProgress(self.progress);

        // Native momentum can paint one overshoot frame before scrollY is
        // restored to the adjacent boundary. Keep the animation at the held
        // boundary throughout that correction so progress-linked copy never
        // advances and then visibly reverses.
        if (boundaryLocked && heldScroll !== null) {
          return getExactBoundaryProgress(heldScroll, self);
        }

        if (
          gestureExiting
          || !gestureDirection
          || gestureBoundaryScroll === null
        ) return nativeProgress;

        const boundaryProgress = getExactBoundaryProgress(gestureBoundaryScroll, self);
        return gestureDirection > 0
          ? Math.min(nativeProgress, boundaryProgress)
          : Math.max(nativeProgress, boundaryProgress);
      };

      touchIntentObserver = ScrollTrigger.observe({ target: window, type: "touch" });
      touchObserver = ScrollTrigger.observe({
        target: window,
        type: "touch",
        allowClicks: true,
        lockAxis: true,
        debounce: true,
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
        // ScrollTrigger may call onEnter synchronously during create(), before
        // the outer `trigger` variable receives the returned instance. Use the
        // callback's controller so initial/hash entry can still establish its
        // first boundary without dereferencing null.
        lockBoundary(entryScroll, self);
        // The gesture that crossed into the story is spent on entry. The next
        // fresh press releases this gate and begins continuous scene scrubbing.
        gestureStartScroll = entryScroll;
        gestureBoundaryScroll = null;
        gestureDirection = 0;
        animation.progress(progress).pause();
      };

      trigger = ScrollTrigger.create({
        ...mobileTriggerVars,
        onUpdate: (self) => {
          animation.progress(getGuardedVisualProgress(self)).pause();
          originalOnUpdate?.(self);
        },
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
          gestureExiting = false;
          touchObserver.disable();
          releaseBoundary();
        },
        onLeaveBack: (self) => {
          originalOnLeaveBack?.(self);
          gestureExiting = false;
          touchObserver.disable();
          releaseBoundary();
        }
      });

      if (trigger.isActive) {
        lockBoundary(trigger.scroll());
        animation.progress(getGuardedVisualProgress(trigger)).pause();
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
