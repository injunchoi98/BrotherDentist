import { subscribeViewportState } from "../utils/viewport-state.js";

export function initBrandReveal() {
  const section = document.querySelector("[data-brand-reveal]");
  if (!section) return;
  const mask = section.querySelector("[data-brand-mask]");
  const sticky = section.querySelector(".brand-sticky");
  let active = false;

  const update = () => {
    const rect = section.getBoundingClientRect();
    const distance = Math.max(1, section.offsetHeight - (sticky?.offsetHeight || document.documentElement.clientHeight));
    const scrolled = Math.min(distance, Math.max(0, -rect.top));
    const startDistance = Math.min(distance - 1, (distance * .08) + 100);
    const growth = Math.max(0, (scrolled - startDistance) / Math.max(1, distance - startDistance));
    const eased = growth * growth * (3 - (2 * growth));
    mask.style.setProperty("--reveal", eased.toFixed(4));
    mask.classList.toggle("is-visible", scrolled > startDistance);
  };
  const reset = () => {
    mask.style.removeProperty("--reveal");
    mask.classList.remove("is-visible");
  };

  return subscribeViewportState(({ pinningAllowed }) => {
    if (pinningAllowed === active) return;
    active = pinningAllowed;

    if (active) {
      update();
      addEventListener("scroll", update, { passive: true });
    } else {
      removeEventListener("scroll", update);
      reset();
    }
  });
}
