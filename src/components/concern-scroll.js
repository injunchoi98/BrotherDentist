import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { concerns } from "../data.js";

gsap.registerPlugin(ScrollTrigger);

export function initConcernScroll() {
  const section = document.querySelector("[data-concern]");
  if (!section) return;
  const panel = section.querySelector(".concern-sticky");
  const heading = section.querySelector("[data-concern-heading]");
  const copy = section.querySelector("[data-concern-copy]");
  const patient = section.querySelector("[data-patient]");
  let current = -1;

  const render = (index, animate = true) => {
    if (index === current) return;
    current = index;
    const item = concerns[index];
    heading.textContent = item.heading;
    copy.textContent = item.copy;
    panel.toggleAttribute("data-final-scene", item.pose === null);
    patient.toggleAttribute("aria-hidden", item.pose === null);
    if (item.pose !== null) patient.dataset.pose = String(item.pose);
    patient.setAttribute("aria-label", item.pose === null ? "" : `${item.heading}, ${item.copy}`);
    if (!animate) return;
    gsap.fromTo([heading, copy], { autoAlpha: .3, y: 8 }, { autoAlpha: 1, y: 0, duration: .28, stagger: .04, overwrite: true });
    gsap.to(patient, { autoAlpha: item.pose === null ? 0 : 1, y: item.pose === null ? 20 : 0, duration: .35, overwrite: true });
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
