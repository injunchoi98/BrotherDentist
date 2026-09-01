import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard
} from "../utils/pin-height-guard.js";

gsap.registerPlugin(ScrollTrigger);

export function initConcernScroll() {
  const section = document.querySelector("[data-concern]");
  if (!section) return;
  const chatHeader = section.querySelector("[data-concern-chat-header]");
  const dialogue = section.querySelector("[data-concern-dialogue]");
  const messages = gsap.utils.toArray("[data-concern-message]", section);
  const header = document.querySelector("[data-header]");

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
       * SECTION 2 — NATIVE CONTINUOUS CHAT CONTRACT
       *
       * 사용자 의도: 이 구간에서 스크롤을 단계별로 붙잡거나 스냅하지
       * 않는다. 브라우저의 기본 스크롤 거리를 그대로 사용하면서 섹션
       * 안의 진행률에 맞춰 말풍선만 연속적으로 나타나고 사라진다.
       *
       * ScrollTrigger observes document progress only. It does not install a
       * wheel/touch Observer, prevent default input, restore scroll positions,
       * or define snap points. Keyboard, wheel, and touch therefore all keep
       * their native page-scrolling behavior.
       */
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "concern-native-scroll",
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true
        }
      });

      gsap.set([chatHeader, dialogue, messages[0]], { autoAlpha: 1 });
      gsap.set(messages.slice(1), {
        autoAlpha: 0,
        y: 18,
        // Message 2 is left-aligned and message 3 returns to the right. Each
        // new bubble enters from its own edge while the earlier bubbles remain
        // visible, so the conversation visibly accumulates one step at a time.
        x: (index) => index % 2 === 0 ? -18 : 18,
        scale: .96
      });

      timeline
        .to(messages[1], { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: .45 })
        .to(messages[2], { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: .45 })
        .to([chatHeader, ...messages], {
          autoAlpha: 0,
          y: -16,
          scale: .78,
          duration: .6,
          stagger: { each: .035, from: "end" },
          ease: "power3.in"
        });

      return () => {
        timeline.scrollTrigger?.kill();
        timeline.kill();
      };
    },
    onDisable: showStaticStory
  });
}
