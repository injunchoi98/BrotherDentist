import { cases } from "../data.js";
import { initImageCompare } from "./image-compare.js";

const compareMarkup = (item, index) => `
  <article class="case-card" data-case-card>
    <div class="image-compare" data-compare style="--compare: 50%">
      <div class="compare-half compare-before"><img src="${item.image}" alt="${item.category} 치료 전 목업 이미지" /></div>
      <div class="compare-half compare-after"><img src="${item.image}" alt="${item.category} 치료 후 목업 이미지" /></div>
      <div class="compare-line" aria-hidden="true"><span>↔</span></div>
      <input type="range" min="5" max="95" value="50" aria-label="${item.category} 치료 전후 비교 위치" />
      <span class="compare-label compare-label-before">BEFORE</span><span class="compare-label compare-label-after">AFTER</span>
    </div>
    <div class="case-copy"><span>${item.category}</span><h3>${item.title}</h3><p>${item.copy}</p></div>
  </article>`;

export function initCoverflow() {
  const root = document.querySelector("[data-coverflow]");
  if (!root) return;
  const track = root.querySelector("[data-coverflow-track]");
  track.innerHTML = cases.map(compareMarkup).join("");
  root.insertAdjacentHTML("beforeend", `
    <div class="coverflow-controls" aria-label="치료 증례 이동">
      <button type="button" data-case-prev aria-label="이전 치료 증례">←</button>
      <span aria-live="polite"><strong data-case-current>01</strong> / ${String(cases.length).padStart(2, "0")}</span>
      <button type="button" data-case-next aria-label="다음 치료 증례">→</button>
    </div>`);
  const cards = [...track.children];
  const currentLabel = root.querySelector("[data-case-current]");
  let active = 0;
  let pointerStart = null;
  let autoplay = null;

  const render = () => {
    cards.forEach((card, index) => {
      let offset = index - active;
      const half = Math.floor(cards.length / 2);
      if (offset > half) offset -= cards.length;
      if (offset < -half) offset += cards.length;
      card.style.setProperty("--offset", offset);
      card.style.setProperty("--abs-offset", Math.abs(offset));
      card.style.zIndex = String(cards.length - Math.abs(offset));
      card.toggleAttribute("data-active", offset === 0);
      card.toggleAttribute("data-neighbor", Math.abs(offset) === 1);
      card.toggleAttribute("data-visible", Math.abs(offset) <= 1);
      card.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
      card.querySelector("input").tabIndex = offset === 0 ? 0 : -1;
    });
    currentLabel.textContent = String(active + 1).padStart(2, "0");
  };
  const move = (amount) => { active = (active + amount + cards.length) % cards.length; render(); };
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
    active = cards.indexOf(card);
    render();
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
