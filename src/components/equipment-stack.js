import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createPinHeightGuard } from "../utils/pin-height-guard.js";

gsap.registerPlugin(ScrollTrigger);

const CARD_SEQUENCE_END = .9;
const CARD_STEP_HYSTERESIS = .018;

export function initEquipmentStack() {
  const root = document.querySelector("[data-equipment-stack]");
  if (!root) return;

  const stage = root.querySelector(".equipment-stack-stage");
  const cards = [...root.querySelectorAll("[data-equipment-card]")];
  const status = root.querySelector("[data-equipment-status]");
  const panel = root.closest("[data-evidence-panel]");
  let active = 0;
  let pointerId = null;
  let pointerStart = 0;
  let scrollTrigger = null;

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

  const setActive = (index) => {
    active = Math.max(0, Math.min(cards.length - 1, index));
    render();
  };

  const getCardAnchorProgress = (index) => (
    ((index + .5) / cards.length) * CARD_SEQUENCE_END
  );

  const move = (amount) => {
    const next = Math.max(0, Math.min(cards.length - 1, active + amount));
    if (next === active) return;

    // While pinned, scroll position is the single source of truth. Moving the
    // viewport to the requested card prevents controls and scroll updates from
    // overwriting each other on the following frame.
    if (scrollTrigger?.enabled && !panel.hasAttribute("data-pin-disabled")) {
      const target = scrollTrigger.start
        + (getCardAnchorProgress(next) * (scrollTrigger.end - scrollTrigger.start));
      scrollTo({ top: target, behavior: "smooth" });
      return;
    }

    setActive(next);
  };

  const getScrollCardIndex = (progress) => Math.min(
    cards.length - 1,
    Math.floor((progress / CARD_SEQUENCE_END) * cards.length)
  );

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

  const cancelDrag = (event) => {
    if (event.pointerId !== pointerId) return;
    resetActiveCard();
    pointerId = null;
  };

  stage.addEventListener("pointerup", finishDrag);
  // A native vertical pan fires pointercancel. It must only cancel the card
  // gesture; treating it like pointerup advanced the deck during scrolling and
  // wrapped card 6 back to card 1.
  stage.addEventListener("pointercancel", cancelDrag);
  root.querySelector("[data-equipment-prev]")?.addEventListener("click", () => move(-1));
  root.querySelector("[data-equipment-next]")?.addEventListener("click", () => move(1));
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  });

  render();
  return createPinHeightGuard({
    section: panel,
    minimumHeightRem: ({ layout }) => layout === "mobile" ? 40 : 44,
    onEnable: () => {
      scrollTrigger = ScrollTrigger.create({
        id: "equipment-pin-progress",
        trigger: panel,
        start: "top top",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onUpdate: ({ progress: scrollProgress }) => {
          const next = getScrollCardIndex(scrollProgress);
          if (next === active || pointerId !== null) return;

          // Trackpads can briefly report a tiny reverse delta at a card
          // boundary. Keep the newer card until the reader has moved a clear
          // distance back across that boundary, preventing 5 → 6 → 5 flicker.
          const activeStart = (active / cards.length) * CARD_SEQUENCE_END;
          if (next < active && scrollProgress > activeStart - CARD_STEP_HYSTERESIS) return;

          setActive(next);
        }
      });
      return () => {
        scrollTrigger?.kill();
        scrollTrigger = null;
      };
    },
    onDisable: () => {
      setActive(0);
    }
  });
}
