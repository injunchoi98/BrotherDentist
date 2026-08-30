import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronLeft, Menu, Search } from "reicon";
import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard
} from "../utils/pin-height-guard.js";
import { createDiscreteStageScrollTrigger } from "../utils/discrete-stage-scroll.js";

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
      /*
       * SECTION 2 — DISCRETE CHAT CONTRACT
       *
       * 사용자 의도: 강한 스와이프 한 번으로 이 섹션 전체를 넘기지
       * 않는다. 말풍선 하나가 한 단계이며, 마지막 말풍선 다음에 들어온
       * 별도의 스와이프만 "필요한 치료만 정직하게" 섹션으로 이동한다.
       *
       * The three bubbles are three complete resting states on every viewport.
       * One physical wheel, swipe, or keyboard gesture must reveal at most one
       * new bubble even when that gesture has enough velocity to cross the
       * section. Intermediate progress between bubbles has no product meaning,
       * so the controller drives this timeline directly between named labels.
       *
       * Do not reuse the showcase section's continuous boundary controller here.
       * Conversely, do not reuse this discrete controller for showcase: its
       * photos, words and map carry meaning while they move between titles.
       */
      const timeline = gsap.timeline({
        paused: true,
        // The stage controller eases the timeline's playhead with tweenTo().
        // Keep inner reveals linear so forward and reverse do not compound two
        // eases and recreate the former delayed hide on upward navigation.
        defaults: { ease: "none" }
      });
      const stageLabels = Object.freeze(["first", "second", "third"]);

      gsap.set([chatHeader, dialogue, messages[0]], { autoAlpha: 1 });
      gsap.set(messages.slice(1), { autoAlpha: 0, y: 18, scale: .96 });

      timeline
        .addLabel(stageLabels[0], 0)
        // A reveal begins immediately after input. The former empty hold tweens
        // made a valid swipe look ignored before each bubble finally appeared.
        .to(messages[1], { autoAlpha: 1, y: 0, scale: 1, duration: .45 })
        .addLabel(stageLabels[1])
        .to(messages[2], { autoAlpha: 1, y: 0, scale: 1, duration: .45 })
        .addLabel(stageLabels[2])
        .to([chatHeader, ...messages], {
          autoAlpha: 0,
          y: -16,
          scale: .78,
          transformOrigin: "right center",
          duration: .6,
          stagger: { each: .035, from: "end" },
          ease: "power3.in"
        });

      const disposeScrollTrigger = createDiscreteStageScrollTrigger({
        section,
        animation: timeline,
        // These timeline labels are the single source of truth for complete
        // scenes. The controller reads their times directly; do not recreate
        // them as normalized progress values or ScrollTrigger snap points.
        stageLabels,
        stepDuration: .32,
        // `bottom bottom` ends while the next section is still one viewport
        // below. Carry the same final gesture to this section's document bottom
        // so the brand section replaces the chat without a blank resting frame.
        forwardExitTarget: () => window.scrollY + section.getBoundingClientRect().bottom,
        start: "top top",
        end: "bottom bottom"
      });

      return () => {
        disposeScrollTrigger?.();
        timeline.kill();
      };
    },
    onDisable: showStaticStory
  });
}
