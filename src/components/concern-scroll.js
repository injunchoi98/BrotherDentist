import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { concerns } from "../data.js";
import { createPinHeightGuard } from "../utils/pin-height-guard.js";

gsap.registerPlugin(ScrollTrigger);

export function initConcernScroll() {
  const section = document.querySelector("[data-concern]");
  if (!section) return;
  const heading = section.querySelector("[data-concern-heading]");
  const copy = section.querySelector("[data-concern-copy]");
  const dialogue = section.querySelector("[data-concern-dialogue]");
  const patient = section.querySelector("[data-patient]");
  let current = -1;

  const render = (index, animate = true) => {
    if (index === current) return;
    current = index;
    const item = concerns[index];
    heading.textContent = item.heading;
    copy.textContent = item.copy;
    patient.dataset.pose = String(item.pose);
    patient.setAttribute("aria-label", `${item.heading}, ${item.copy}`);
    if (!animate) return;
    gsap.fromTo([heading, dialogue], { autoAlpha: .25 }, { autoAlpha: 1, duration: .24, stagger: .04, overwrite: true });
    gsap.to(patient, { autoAlpha: 1, duration: .24, overwrite: true });
  };

  render(0, false);
  return createPinHeightGuard({
    section,
    minimumHeightRem: ({ layout }) => {
      if (layout === "mobile") return 39;
      if (layout === "medium") return 45;
      return 50;
    },
    onEnable: () => {
      const trigger = ScrollTrigger.create({
        id: "concern-pin-progress",
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        scrub: .35,
        invalidateOnRefresh: true,
        onUpdate: ({ progress }) => render(Math.min(concerns.length - 1, Math.floor(progress * concerns.length)))
      });
      return () => trigger.kill();
    },
    onDisable: () => render(0, false)
  });
}
