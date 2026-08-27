import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createPinHeightGuard } from "../utils/pin-height-guard.js";

gsap.registerPlugin(ScrollTrigger);

export function initEquipmentStack() {
  const root = document.querySelector("[data-equipment-stack]");
  if (!root) return;

  const stage = root.querySelector(".equipment-stack-stage");
  const cards = [...root.querySelectorAll("[data-equipment-card]")];
  const status = root.querySelector("[data-equipment-status]");
  let active = 0;
  let pointerId = null;
  let pointerStart = 0;

  const render = () => {
    cards.forEach((card, index) => {
      const position = (index - active + cards.length) % cards.length;
      const visiblePosition = Math.min(position, 3);
      card.dataset.stackDepth = String(position);
      card.style.setProperty("--stack-y", `${visiblePosition * 12}px`);
      card.style.setProperty("--stack-scale", String(1 - (visiblePosition * .035)));
      card.style.setProperty("--stack-rotate", `${visiblePosition === 0 ? 0 : visiblePosition % 2 ? 1.4 : -1.1}deg`);
      card.style.zIndex = String(cards.length - position);
      card.style.opacity = position > 3 ? "0" : String(1 - (visiblePosition * .13));
      card.toggleAttribute("data-active", position === 0);
      card.setAttribute("aria-hidden", position === 0 ? "false" : "true");
    });
    status.textContent = String(active + 1);
  };

  const move = (amount) => {
    active = (active + amount + cards.length) % cards.length;
    render();
  };

  const resetActiveCard = () => {
    const card = cards[active];
    card.style.removeProperty("--drag-x");
    card.style.removeProperty("--drag-rotate");
    card.removeAttribute("data-dragging");
  };

  stage.addEventListener("pointerdown", (event) => {
    const card = cards[active];
    pointerId = event.pointerId;
    pointerStart = event.clientX;
    stage.setPointerCapture(pointerId);
    card.setAttribute("data-dragging", "");
  });

  stage.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    const delta = event.clientX - pointerStart;
    const card = cards[active];
    card.style.setProperty("--drag-x", `${delta}px`);
    card.style.setProperty("--drag-rotate", `${delta / 24}deg`);
  });

  const finishDrag = (event) => {
    if (event.pointerId !== pointerId) return;
    const delta = event.clientX - pointerStart;
    resetActiveCard();
    if (Math.abs(delta) < 8) move(1);
    else if (Math.abs(delta) > 72) move(delta < 0 ? 1 : -1);
    pointerId = null;
  };

  stage.addEventListener("pointerup", finishDrag);
  stage.addEventListener("pointercancel", finishDrag);
  root.querySelector("[data-equipment-prev]")?.addEventListener("click", () => move(-1));
  root.querySelector("[data-equipment-next]")?.addEventListener("click", () => move(1));
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });

  render();
  const panel = root.closest("[data-evidence-panel]");
  return createPinHeightGuard({
    section: panel,
    minimumHeightRem: () => matchMedia("(max-width: 48rem)").matches ? 40 : 48,
    onEnable: () => {
      const trigger = ScrollTrigger.create({
        id: "equipment-pin-progress",
        trigger: panel,
        start: "top top",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onUpdate: ({ progress: scrollProgress }) => {
          const next = Math.min(cards.length - 1, Math.floor(scrollProgress * cards.length));
          if (next === active || pointerId !== null) return;
          active = next;
          render();
        }
      });
      return () => trigger.kill();
    },
    onDisable: () => {
      active = 0;
      render();
    }
  });
}
