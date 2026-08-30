import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronLeft, Menu, Search } from "reicon";
import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard
} from "../utils/pin-height-guard.js";
import { createResponsiveStageScrollTrigger } from "../utils/mobile-scroll.js";

gsap.registerPlugin(ScrollTrigger);

const concernIcons = {
  "arrow-left": ChevronLeft,
  search: Search,
  menu: Menu
};

const renderConcernIcons = (section) => {
  section.querySelectorAll("[data-concern-icon]").forEach((slot) => {
    const createIcon = concernIcons[slot.dataset.concernIcon];
    if (!createIcon) return;
    slot.replaceChildren(createIcon({
      size: 24,
      color: "currentColor",
      className: "concern-chat-icon",
      attrs: { "aria-hidden": "true", focusable: "false" }
    }));
  });
};

export function initConcernScroll() {
  const section = document.querySelector("[data-concern]");
  if (!section) return;
  const chatHeader = section.querySelector("[data-concern-chat-header]");
  const dialogue = section.querySelector("[data-concern-dialogue]");
  const messages = gsap.utils.toArray("[data-concern-message]", section);
  const header = document.querySelector("[data-header]");

  renderConcernIcons(section);

  const getTextMinimumHeightRem = () => {
    const copyStyles = getComputedStyle(section.querySelector(".concern-copy"));
    const dialogueStyles = getComputedStyle(dialogue);
    const copyGap = Number.parseFloat(copyStyles.rowGap || copyStyles.gap) || 0;
    const messageGap = Number.parseFloat(dialogueStyles.rowGap || dialogueStyles.gap) || 0;
    const messageHeight = messages.reduce(
      // offsetHeight deliberately ignores the timeline's scale transform, so
      // resizing while the bubbles are shrinking cannot lower the threshold.
      (height, message) => height + message.offsetHeight,
      0
    );
    const contentHeightPixels = chatHeader.offsetHeight
      + copyGap
      + messageHeight
      + (messageGap * Math.max(0, messages.length - 1));

    // The pin is allowed only when the complete essential story fits: fixed
    // header + title + all three bubbles + the CSS-declared minimum gaps.
    // Decorative imagery is no longer part of this scene or this calculation.
    return calculatePinMinimumHeightRem({
      headerHeightPixels: header?.getBoundingClientRect().height || 0,
      contentHeightPixels,
      topSafetyRem: 1,
      bottomSafetyRem: 1
    });
  };

  const showStaticStory = () => {
    gsap.set([chatHeader, dialogue, ...messages], {
      autoAlpha: 1,
      clearProps: "transform"
    });
  };

  return createPinHeightGuard({
    section,
    allowMobile: true,
    minimumHeightRem: getTextMinimumHeightRem,
    onEnable: () => {
      // The concern story is intentionally discrete: one wheel stroke or one
      // finger swipe reveals exactly one chat panel. The shared helper follows
      // GSAP's official Observer pattern by freezing the saved scroll position
      // while a panel transition is running and discarding residual momentum.
      const timeline = gsap.timeline({
        paused: true,
        defaults: { ease: "power2.out" }
      });

      gsap.set([chatHeader, dialogue, messages[0]], { autoAlpha: 1 });
      gsap.set(messages.slice(1), { autoAlpha: 0, y: 18, scale: .96 });

      timeline
        .addLabel("first", 0)
        .to({}, { duration: .7 })
        .to(messages[1], { autoAlpha: 1, y: 0, scale: 1, duration: .7 })
        .addLabel("second")
        .to({}, { duration: .45 })
        .to(messages[2], { autoAlpha: 1, y: 0, scale: 1, duration: .7 })
        .addLabel("third")
        .to({}, { duration: .7 })
        .to([chatHeader, ...messages], {
          autoAlpha: 0,
          y: -16,
          scale: .78,
          transformOrigin: "right center",
          duration: .75,
          stagger: { each: .035, from: "end" },
          ease: "power3.in"
        });

      // Only states with visible chat content are Observer panels. The fully
      // collapsed state at the end of the timeline is an exit transition, not
      // a fourth panel; stopping there would expose an empty blue viewport.
      const stagePoints = ["first", "second", "third"]
        .map((label) => timeline.labels[label] / timeline.duration());
      const disposeScrollTrigger = createResponsiveStageScrollTrigger({
        mobileStepPoints: stagePoints,
        observeDesktopWheel: true,
        stepDuration: .32,
        backEntryPoint: stagePoints[2],
        // `bottom bottom` ends while the next section is still one viewport
        // below. Carry the same final gesture to this section's document bottom
        // so the brand section replaces the chat without a blank resting frame.
        forwardExitTarget: () => window.scrollY + section.getBoundingClientRect().bottom,
        vars: {
          id: "concern-observer-panels",
          trigger: section,
          animation: timeline,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true
        }
      });

      return () => {
        disposeScrollTrigger?.();
        timeline.kill();
      };
    },
    onDisable: showStaticStory
  });
}
