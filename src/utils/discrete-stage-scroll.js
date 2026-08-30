import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const interactiveSelector = "a, button, input, textarea, select, [data-nav]";

const resolveTarget = (requestedTarget, fallback) => {
  const target = typeof requestedTarget === "function"
    ? requestedTarget()
    : requestedTarget;
  return Number.isFinite(target) ? target : fallback;
};

const getKeyDirection = (event) => {
  if (event.code === "Space") return event.shiftKey ? -1 : 1;
  if (event.key === "ArrowDown" || event.key === "PageDown") return 1;
  if (event.key === "ArrowUp" || event.key === "PageUp") return -1;
  return 0;
};

/**
 * A discrete, label-driven story controller.
 *
 * SINGLE SOURCE OF TRUTH
 * ----------------------
 * The supplied GSAP timeline labels are the only definitions of story stages.
 * This controller deliberately has no progress array, snap thresholds, or
 * scroll-distance-to-stage conversion. `currentStageIndex` only records which
 * of those named labels is currently resting; it never defines another timing
 * model.
 *
 * OWNERSHIP
 * ---------
 * - ScrollTrigger owns only the section's entry and exit range.
 * - Observer translates one physical wheel/touch stream into one direction.
 * - The paused GSAP timeline owns all visual state and moves with tweenTo().
 * - ScrollToPlugin is used only for the final handoff between page sections.
 *
 * Do not add scrub or snap here. Those APIs make scroll position the animation
 * source, while this component's complete bubble states are the source. Mixing
 * both models lets momentum, snap, and direct tweens fight over one timeline.
 */
export function createDiscreteStageScrollTrigger({
  section,
  animation,
  stageLabels,
  stepDuration = .32,
  forwardExitTarget = null,
  start = "top top",
  end = "bottom bottom"
}) {
  if (!section || !animation) return () => {};

  const labels = [...new Set(stageLabels || [])];
  if (!labels.length) return () => {};
  labels.forEach((label) => {
    if (!Object.hasOwn(animation.labels, label)) {
      throw new Error(`Unknown discrete story label: ${label}`);
    }
  });

  let trigger = null;
  let touchIntentObserver = null;
  let wheelIntentObserver = null;
  let touchStageObserver = null;
  let wheelStageObserver = null;
  let stageTween = null;
  let scrollTween = null;
  let currentStageIndex = 0;
  let storyActive = false;
  let exiting = false;
  let frozenScroll = null;
  let frozenHash = "";
  let touchGestureConsumed = false;
  let wheelGestureConsumed = false;
  let wheelStreamActive = false;
  let wheelStreamEvent = null;
  let previousInlineScrollBehavior = null;
  let lastTouchX = null;
  let lastTouchY = null;

  const restoreNativeScrollBehavior = () => {
    if (previousInlineScrollBehavior === null) return;
    document.documentElement.style.scrollBehavior = previousInlineScrollBehavior;
    previousInlineScrollBehavior = null;
  };

  const suspendNativeSmoothScroll = () => {
    if (previousInlineScrollBehavior !== null) return;
    previousInlineScrollBehavior = document.documentElement.style.scrollBehavior;
    // The page normally uses CSS smooth scrolling for anchor navigation. A
    // GSAP ScrollTo tween already supplies its own easing; allowing both layers
    // to smooth the same writes truncates the handoff before its real target.
    document.documentElement.style.scrollBehavior = "auto";
  };

  const releaseFrozenScroll = () => {
    frozenScroll = null;
    document.removeEventListener("scroll", restoreFrozenScroll);
  };

  function deactivateStory() {
    storyActive = false;
    exiting = false;
    touchStageObserver?.disable();
    wheelStageObserver?.disable();
    releaseFrozenScroll();
  }

  function restoreFrozenScroll() {
    if (!storyActive || exiting || frozenScroll === null || !trigger) return;
    if (location.hash !== frozenHash) {
      deactivateStory();
      return;
    }
    if (Math.abs(trigger.scroll() - frozenScroll) > .5) {
      trigger.scroll(frozenScroll);
    }
  }

  const freezeDocumentAt = (position, controller = trigger) => {
    frozenScroll = position;
    frozenHash = location.hash;
    controller?.scroll(position);
    document.removeEventListener("scroll", restoreFrozenScroll);
    document.addEventListener("scroll", restoreFrozenScroll, { passive: true });
  };

  const setStage = (index, animate = true) => {
    const nextIndex = gsap.utils.clamp(0, labels.length - 1, index);
    const nextLabel = labels[nextIndex];
    currentStageIndex = nextIndex;
    stageTween?.kill();

    if (!animate) {
      animation.seek(nextLabel).pause();
      stageTween = null;
      return;
    }

    // tweenTo() makes the timeline itself the animation authority. Forward and
    // reverse use the same duration/ease, so hiding a bubble cannot acquire the
    // delayed reverse behavior produced by a scrubbed out-ease.
    stageTween = animation.tweenTo(nextLabel, {
      duration: stepDuration,
      ease: "power2.inOut",
      overwrite: true,
      onComplete: () => {
        stageTween = null;
      }
    });
  };

  const scrollOutOfStory = (position, onComplete) => {
    scrollTween?.kill();
    releaseFrozenScroll();
    suspendNativeSmoothScroll();
    scrollTween = gsap.to(window, {
      scrollTo: { y: position, autoKill: false },
      duration: stepDuration,
      ease: "power2.inOut",
      overwrite: true,
      onComplete: () => {
        scrollTween = null;
        restoreNativeScrollBehavior();
        onComplete?.();
      },
      onInterrupt: () => {
        restoreNativeScrollBehavior();
      }
    });
  };

  const exitForward = () => {
    if (exiting) return;
    exiting = true;
    stageTween?.kill();

    // The collapse is not a fourth stage. It runs only after the third label is
    // already resting and only together with the separate section-exit gesture.
    stageTween = animation.tweenTo(animation.duration(), {
      duration: stepDuration,
      ease: "power3.inOut",
      overwrite: true,
      onComplete: () => {
        stageTween = null;
      }
    });

    scrollOutOfStory(
      resolveTarget(
        forwardExitTarget,
        trigger.end + document.documentElement.clientHeight
      ),
      deactivateStory
    );
  };

  const exitBackward = () => {
    if (exiting) return;
    exiting = true;
    // There is no hidden transition before the first bubble. Move just outside
    // the trigger and then return page scrolling to the browser.
    scrollOutOfStory(trigger.start - 2, deactivateStory);
  };

  const beginNativeBackwardExit = () => {
    if (!storyActive || exiting || currentStageIndex !== 0) return false;

    /*
     * FIRST-SCENE OUTER EDGE CONTRACT
     *
     * 첫 말풍선에서 위로 향하는 입력은 이 스토리의 단계 이동이 아니다.
     * 고정, preventDefault, ScrollTo 트윈을 모두 해제하고 현재 제스처를
     * 브라우저에 그대로 넘긴다. 따라서 진입 래치가 아직 닫혀 있더라도
     * 사용자는 첫 장면에서 이전 섹션으로 즉시 돌아갈 수 있다.
     *
     * The final scene intentionally does not use this escape hatch: its forward
     * gesture still owns the coordinated collapse into the brand section.
     */
    deactivateStory();
    return true;
  };

  const moveOneStage = (direction) => {
    if (
      !storyActive
      || exiting
      || stageTween?.isActive()
      || scrollTween?.isActive()
    ) return;

    const nextIndex = currentStageIndex + direction;
    if (nextIndex >= 0 && nextIndex < labels.length) {
      setStage(nextIndex);
      return;
    }
    if (direction > 0) exitForward();
    else exitBackward();
  };

  const consumeTouchGesture = (direction) => {
    if (touchGestureConsumed) return;
    touchGestureConsumed = true;
    moveOneStage(direction);
  };

  const consumeWheelGesture = (direction) => {
    if (wheelGestureConsumed) return;
    wheelGestureConsumed = true;
    moveOneStage(direction);
  };

  const activateStory = (controller, stageIndex, position) => {
    const activeTouchEvent = touchIntentObserver?.isPressed
      ? touchIntentObserver.event
      : undefined;
    const activeWheelEvent = wheelStreamActive ? wheelStreamEvent : undefined;

    storyActive = true;
    exiting = false;
    setStage(stageIndex, false);
    freezeDocumentAt(position, controller);
    touchStageObserver?.enable(activeTouchEvent);
    wheelStageObserver?.enable(activeWheelEvent);

    // The gesture that crossed the section boundary has already done its job:
    // entering the first/third complete state. Its kinetic tail must not also
    // reveal or hide another bubble. Each latch resets only with a fresh input.
    touchGestureConsumed = Boolean(activeTouchEvent);
    wheelGestureConsumed = Boolean(activeWheelEvent);
  };

  touchIntentObserver = ScrollTrigger.observe({
    target: window,
    type: "touch"
  });
  wheelIntentObserver = ScrollTrigger.observe({
    target: window,
    type: "wheel",
    debounce: false,
    onStopDelay: .22,
    onWheel: (self) => {
      wheelStreamActive = true;
      wheelStreamEvent = self.event;
    },
    onStop: () => {
      wheelStreamActive = false;
      wheelStreamEvent = null;
      // Entry can enable the stage observer after the crossing wheel event has
      // already fired. In that case only this always-on intent observer sees
      // the stream end, so it is the authoritative place to reopen the latch.
      if (storyActive && !exiting) wheelGestureConsumed = false;
    }
  });

  touchStageObserver = ScrollTrigger.observe({
    target: window,
    type: "touch",
    preventDefault: true,
    allowClicks: true,
    lockAxis: true,
    dragMinimum: 8,
    tolerance: 14,
    ignore: interactiveSelector,
    onPress: () => {
      touchGestureConsumed = Boolean(
        exiting || stageTween?.isActive() || scrollTween?.isActive()
      );
    },
    onUp: () => consumeTouchGesture(1),
    onDown: () => consumeTouchGesture(-1)
  });
  touchStageObserver.disable();

  wheelStageObserver = ScrollTrigger.observe({
    target: window,
    type: "wheel",
    preventDefault: true,
    debounce: false,
    onStopDelay: .22,
    ignore: interactiveSelector,
    // ignoreCheck runs before Observer's preventDefault. Releasing the story
    // here lets this very wheel event and its remaining momentum stay native.
    ignoreCheck: (event) => (
      event.deltaY < 0 && beginNativeBackwardExit()
    ),
    onWheel: (self) => consumeWheelGesture(self.deltaY > 0 ? 1 : -1),
    onStop: () => {
      wheelGestureConsumed = false;
    }
  });
  wheelStageObserver.disable();

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    lastTouchX = touch?.clientX ?? null;
    lastTouchY = touch?.clientY ?? null;
  };
  const handleTouchMove = (event) => {
    const touch = event.touches[0];
    if (!touch || lastTouchX === null || lastTouchY === null) return;

    const deltaX = touch.clientX - lastTouchX;
    const deltaY = touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    // A finger moving downward means the document should move upward. This
    // capture listener runs before Observer's touchmove listener, so disabling
    // the Observer here prevents it from cancelling the native edge gesture.
    if (deltaY > 0 && Math.abs(deltaY) >= Math.abs(deltaX)) {
      beginNativeBackwardExit();
    }
  };
  const clearTouchPosition = () => {
    lastTouchX = null;
    lastTouchY = null;
  };
  window.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
  window.addEventListener("touchmove", handleTouchMove, { passive: true, capture: true });
  window.addEventListener("touchend", clearTouchPosition, { passive: true, capture: true });
  window.addEventListener("touchcancel", clearTouchPosition, { passive: true, capture: true });

  const handleKeyDown = (event) => {
    const direction = getKeyDirection(event);
    if (!direction || event.target.closest?.(interactiveSelector)) return;
    if (!storyActive) return;
    event.preventDefault();
    if (!event.repeat) moveOneStage(direction);
  };
  document.addEventListener("keydown", handleKeyDown);

  animation.pause();
  trigger = ScrollTrigger.create({
    id: "concern-discrete-story",
    trigger: section,
    start,
    end,
    invalidateOnRefresh: true,
    onEnter: (self) => {
      trigger = self;
      activateStory(self, 0, self.start + 1);
    },
    onEnterBack: (self) => {
      trigger = self;
      activateStory(self, labels.length - 1, self.end - 1);
    },
    onLeave: () => {
      if (!exiting) deactivateStory();
    },
    onLeaveBack: () => {
      if (!exiting) deactivateStory();
    }
  });

  if (trigger.isActive && !storyActive) {
    // Reload/hash entry has no physical entry gesture. Pick the nearest label
    // from label times only; no independent progress thresholds are introduced.
    const requestedTime = trigger.progress * animation.duration();
    const nearestIndex = labels.reduce((best, label, index) => (
      Math.abs(animation.labels[label] - requestedTime)
        < Math.abs(animation.labels[labels[best]] - requestedTime)
        ? index
        : best
    ), 0);
    activateStory(trigger, nearestIndex, trigger.scroll());
  }

  return () => {
    stageTween?.kill();
    scrollTween?.kill();
    restoreNativeScrollBehavior();
    deactivateStory();
    touchIntentObserver?.kill();
    wheelIntentObserver?.kill();
    touchStageObserver?.kill();
    wheelStageObserver?.kill();
    trigger?.kill();
    document.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("touchstart", handleTouchStart, { capture: true });
    window.removeEventListener("touchmove", handleTouchMove, { capture: true });
    window.removeEventListener("touchend", clearTouchPosition, { capture: true });
    window.removeEventListener("touchcancel", clearTouchPosition, { capture: true });
  };
}
