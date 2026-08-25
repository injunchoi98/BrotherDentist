import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { concerns } from "../data.js";

gsap.registerPlugin(ScrollTrigger);

export function initConcernScroll() {
  const section = document.querySelector("[data-concern]");
  if (!section) return;
  const panel = section.querySelector(".concern-sticky");
  const eyebrow = section.querySelector("[data-concern-eyebrow]");
  const title = section.querySelector("[data-concern-title]");
  const copy = section.querySelector("[data-concern-copy]");
  const patient = section.querySelector("[data-patient]");
  let current = -1;

  const render = (index, animate = true) => {
    if (index === current) return;
    current = index;
    const item = concerns[index];
    eyebrow.textContent = item.eyebrow;
    title.textContent = item.title;
    copy.textContent = item.copy;
    patient.dataset.pose = String(item.pose);
    patient.setAttribute("aria-label", `${item.eyebrow}, ${item.title}`);
    if (!animate) return;
    gsap.fromTo([eyebrow, title, copy], { autoAlpha: .3, y: 8 }, { autoAlpha: 1, y: 0, duration: .28, stagger: .03, overwrite: true });
    gsap.fromTo(patient, { autoAlpha: .55, y: 14 }, { autoAlpha: 1, y: 0, duration: .35, overwrite: true });
  };

  render(0, false);
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const trigger = ScrollTrigger.create({
      trigger: section,
      pin: panel,
      start: "top top",
      end: () => `+=${innerHeight * 3}`,
      scrub: .35,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: ({ progress }) => render(Math.min(concerns.length - 1, Math.floor(progress * concerns.length)))
    });
    return () => trigger.kill();
  });
}
