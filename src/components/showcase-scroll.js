import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const messages = [
  ["소개로 다시 만나는", "신뢰가 이어지는 치과"],
  ["치료 뒤에도 다시 찾는", "일상을 함께하는 치과"],
  ["가족에게도 권하고 싶은", "감동이 이어지는 치과"]
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
