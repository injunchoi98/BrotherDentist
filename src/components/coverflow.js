import { cases } from "../data.js";
import { responsivePicture } from "../utils/responsive-image.js";
import { initImageCompare } from "./image-compare.js";

const modulo = (value, length) => ((value % length) + length) % length;

const compareMarkup = (item, isClone = false) => `
  <article class="case-card" data-case-card${isClone ? " data-case-clone" : ""}>
    <div class="case-card-surface">
      <div class="image-compare" data-compare style="--compare: 50%">
        <div class="compare-half compare-before">${responsivePicture({ source: item.image, widths: [480, 960, 1440], sizes: "(max-width: 48rem) 84vw, 37rem", width: 1774, height: 887, alt: isClone ? "" : (item.beforeAlt || `${item.category} 치료 전 목업 이미지`) })}</div>
        <div class="compare-half compare-after">${responsivePicture({ source: item.image, widths: [480, 960, 1440], sizes: "(max-width: 48rem) 84vw, 37rem", width: 1774, height: 887, alt: isClone ? "" : (item.afterAlt || `${item.category} 치료 후 목업 이미지`) })}</div>
        <div class="compare-line" aria-hidden="true"><span></span></div>
        <input type="range" min="5" max="95" value="50" aria-label="${item.category} 치료 전후 비교 위치" />
        <span class="compare-label compare-label-before">BEFORE</span><span class="compare-label compare-label-after">AFTER</span>
      </div>
      <div class="case-copy"><span>${item.category}</span><h3>${item.title}</h3><p>${item.copy}</p></div>
    </div>
  </article>`;

export function initCoverflow(root = document.querySelector("[data-coverflow]"), items = cases) {
  if (!root) return;
  const track = root.querySelector("[data-coverflow-track]");
  if (!track || !items.length) return;
  const renderedItems = [...items, ...items, ...items];
  track.innerHTML = renderedItems
    .map((item, index) => compareMarkup(item, index < items.length || index >= items.length * 2))
    .join("");
  root.insertAdjacentHTML("beforeend", `
    <div class="coverflow-controls" aria-label="${root.dataset.coverflowLabel || "치료 증례"} 이동">
      <button type="button" data-case-prev aria-label="이전 치료 증례">←</button>
      <span aria-live="polite"><strong data-case-current>01</strong> / ${String(items.length).padStart(2, "0")}</span>
      <button type="button" data-case-next aria-label="다음 치료 증례">→</button>
    </div>`);
  const cards = [...track.children];
  const currentLabel = root.querySelector("[data-case-current]");
  const visibleRadius = root.classList.contains("coverflow--five") ? 2 : 1;
  let active = items.length;
  let pointerStart = null;
  let autoplay = null;
  let normalizationTimer = null;
  let queuedMovement = 0;
  let snapping = false;

  const render = () => {
    cards.forEach((card, index) => {
      const offset = index - active;
      card.style.setProperty("--offset", offset);
      card.style.setProperty("--abs-offset", Math.abs(offset));
      card.dataset.distance = String(Math.abs(offset));
      card.style.zIndex = String(cards.length - Math.abs(offset));
      card.toggleAttribute("data-active", offset === 0);
      card.toggleAttribute("data-neighbor", Math.abs(offset) === 1);
      card.toggleAttribute("data-visible", Math.abs(offset) <= visibleRadius);
      card.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
      card.querySelector("input").tabIndex = offset === 0 ? 0 : -1;
    });
    currentLabel.textContent = String(modulo(active, items.length) + 1).padStart(2, "0");
  };

  const normalize = () => {
    const middleActive = items.length + modulo(active, items.length);
    if (active === middleActive || snapping) return false;

    snapping = true;
    root.setAttribute("data-coverflow-snap", "");
    active = middleActive;
    render();

    // Keep the equivalent clone snapped for one painted frame. Restoring the
    // transition on the following frame avoids a synchronous layout flush.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.removeAttribute("data-coverflow-snap");
        snapping = false;
        if (!queuedMovement) return;
        const movement = queuedMovement;
        queuedMovement = 0;
        move(movement);
      });
    });
    return true;
  };

  const move = (amount) => {
    window.clearTimeout(normalizationTimer);
    if (snapping) {
      queuedMovement += amount;
      return;
    }
    const nextActive = active + amount;
    const minimumActive = visibleRadius;
    const maximumActive = cards.length - visibleRadius - 1;
    if (nextActive < minimumActive || nextActive > maximumActive) {
      queuedMovement += amount;
      normalize();
      return;
    }
    active += amount;
    render();
    normalizationTimer = window.setTimeout(normalize, 620);
  };
  const stopAutoplay = () => { window.clearInterval(autoplay); autoplay = null; };
  const startAutoplay = () => {
    stopAutoplay();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) autoplay = window.setInterval(() => move(1), 4200);
  };
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });
  track.addEventListener("click", (event) => {
    const card = event.target.closest("[data-case-card]");
    if (!card || card.hasAttribute("data-active")) return;
    move(cards.indexOf(card) - active);
    startAutoplay();
  });
  track.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-compare]")) return;
    pointerStart = event.clientX;
    stopAutoplay();
  });
  track.addEventListener("pointerup", (event) => {
    if (event.target.closest("[data-compare]")) { pointerStart = null; return; }
    if (pointerStart === null) return;
    const delta = event.clientX - pointerStart;
    if (Math.abs(delta) > 48) move(delta > 0 ? -1 : 1);
    pointerStart = null;
    startAutoplay();
  });
  track.addEventListener("pointercancel", () => { pointerStart = null; startAutoplay(); });
  root.addEventListener("mouseenter", stopAutoplay);
  root.addEventListener("mouseleave", startAutoplay);
  root.addEventListener("focusin", stopAutoplay);
  root.addEventListener("focusout", startAutoplay);
  root.querySelector("[data-case-prev]").addEventListener("click", () => { move(-1); startAutoplay(); });
  root.querySelector("[data-case-next]").addEventListener("click", () => { move(1); startAutoplay(); });
  initImageCompare(track);
  render();
  startAutoplay();
}
