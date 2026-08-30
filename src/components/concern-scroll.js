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
  const heading = section.querySelector("[data-concern-heading]");
  const dialogue = section.querySelector("[data-concern-dialogue]");
  const messages = gsap.utils.toArray("[data-concern-message]", section);
  const resolution = section.querySelector("[data-concern-resolution]");
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
    const contentHeightPixels = heading.offsetHeight
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
    gsap.set([heading, dialogue, ...messages], {
      autoAlpha: 1,
      clearProps: "transform"
    });
    gsap.set(resolution, { autoAlpha: 1, clearProps: "transform" });
  };

  return createPinHeightGuard({
    section,
    allowMobile: true,
    minimumHeightRem: getTextMinimumHeightRem,
    onEnable: () => {
      // This section deliberately uses native continuous scroll only. There is
      // no Observer, scroll lock, queued gesture, or snap point: ScrollTrigger
      // simply maps the browser's real position onto this reversible timeline.
      const timeline = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          id: "concern-pin-progress",
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true
        }
      });

      gsap.set([heading, dialogue, messages[0]], { autoAlpha: 1 });
      gsap.set(messages.slice(1), { autoAlpha: 0, y: 18, scale: .96 });
      gsap.set(resolution, { autoAlpha: 0, scale: .72, y: 12 });

      timeline
        .to({}, { duration: .7 })
        .to(messages[1], { autoAlpha: 1, y: 0, scale: 1, duration: .7 })
        .to({}, { duration: .45 })
        .to(messages[2], { autoAlpha: 1, y: 0, scale: 1, duration: .7 })
        .to({}, { duration: .7 })
        .to([heading, ...messages], {
          autoAlpha: 0,
          y: -16,
          scale: .78,
          transformOrigin: "right center",
          duration: .75,
          stagger: { each: .035, from: "end" },
          ease: "power3.in"
        })
        .to(resolution, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: .6,
          ease: "back.out(1.7)"
        }, "-=.05")
        .to({}, { duration: .4 });

      return () => {
        timeline.scrollTrigger?.kill();
        timeline.kill();
      };
    },
    onDisable: showStaticStory
  });
}
