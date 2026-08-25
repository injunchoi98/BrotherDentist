import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initEvidenceScroll() {
  const root = document.querySelector("[data-evidence]");
  if (!root) return;
  const navItems = [...root.querySelectorAll("[data-evidence-nav]")];
  const panels = [...root.querySelectorAll("[data-evidence-panel]")];

  const setCurrent = (index) => {
    navItems.forEach((item, itemIndex) => item.toggleAttribute("aria-current", itemIndex === index));
  };

  setCurrent(0);
  const media = gsap.matchMedia();
  media.add("(min-width: 64.01rem) and (prefers-reduced-motion: no-preference)", () => {
    const triggers = panels.map((panel, index) => ScrollTrigger.create({
      trigger: panel,
      start: "top center",
      end: "bottom center",
      onToggle: ({ isActive }) => {
        if (isActive) setCurrent(index);
      }
    }));
    return () => triggers.forEach((trigger) => trigger.kill());
  });
}
