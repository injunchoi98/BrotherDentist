import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const messages = [
  ["보이는 자료로 함께 확인하고", "모호함 없이 설명하는 진료"],
  ["통증과 긴장을 줄이는 순서까지 설계해", "치료받는 과정까지 편안하게"],
  ["치료 뒤의 변화와 회복까지 살펴", "끝난 뒤에도 이어지는 관리"]
];

export function initShowcaseScroll() {
  const section = document.querySelector("[data-showcase]");
  if (!section) return;
  const panel = section.querySelector("[data-showcase-panel]");
  const images = gsap.utils.toArray("[data-showcase-image]", section);
  const kicker = section.querySelector("[data-showcase-kicker]");
  const title = section.querySelector("[data-showcase-title]");
  let messageIndex = -1;

  const setMessage = (index) => {
    if (index === messageIndex) return;
    messageIndex = index;
    [kicker.textContent, title.textContent] = messages[index];
    gsap.fromTo([kicker, title], { autoAlpha: .2, y: 12 }, { autoAlpha: 1, y: 0, duration: .35, stagger: .05, overwrite: true });
  };

  setMessage(0);
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        pin: panel,
        start: "top top",
        end: () => `+=${innerHeight * 2.6}`,
        scrub: .7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: ({ progress }) => setMessage(Math.min(2, Math.floor(progress * 3)))
      }
    });
    images.forEach((image, index) => {
      timeline.fromTo(image,
        { autoAlpha: 0, scale: .38, xPercent: index % 2 ? -45 : 45, yPercent: index < 2 ? 35 : -35 },
        { autoAlpha: .72, scale: 1, xPercent: 0, yPercent: 0, duration: 1, ease: "power2.out" },
        index * .34
      );
    });
    timeline.fromTo(".showcase-rule", { scaleX: 0 }, { scaleX: 1, duration: .7 }, .7);
    return () => timeline.scrollTrigger?.kill();
  });
}
