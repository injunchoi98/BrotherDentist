import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { subscribeViewportState } from "../utils/viewport-state.js";

gsap.registerPlugin(ScrollTrigger);

export function initEvidenceScroll() {
  const root = document.querySelector("[data-evidence]");
  if (!root) return;
  const navItems = [...root.querySelectorAll("[data-evidence-nav]")];
  const panels = [...root.querySelectorAll("[data-evidence-panel]")];

  const setCurrent = (index) => {
    navItems.forEach((item, itemIndex) => {
      if (itemIndex === index) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
  };

  setCurrent(0);
  let active = false;
  let triggers = [];

  return subscribeViewportState(({ layout, pinningAllowed }) => {
    const nextActive = layout === "desktop" && pinningAllowed;
    if (nextActive === active) return;

    triggers.forEach((trigger) => trigger.kill());
    triggers = [];
    active = nextActive;

    if (!active) {
      setCurrent(0);
      return;
    }

    triggers = panels.map((panel, index) => ScrollTrigger.create({
      trigger: panel,
      start: "top center",
      end: "bottom center",
      onToggle: ({ isActive }) => {
        if (isActive) setCurrent(index);
      }
    }));
  });
}
