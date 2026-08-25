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
  const cards = [...track.children];
  const status = root.querySelector("[data-coverflow-status]");
  let active = 0;
  let pointerStart = null;

  const render = () => {
    cards.forEach((card, index) => {
      const offset = index - active;
      card.style.setProperty("--offset", offset);
      card.style.setProperty("--abs-offset", Math.abs(offset));
      card.style.zIndex = String(cards.length - Math.abs(offset));
      card.toggleAttribute("data-active", offset === 0);
      card.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
      card.querySelector("input").tabIndex = offset === 0 ? 0 : -1;
    });
    status.textContent = `${String(active + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
  };
  const move = (amount) => { active = (active + amount + cards.length) % cards.length; render(); };
  root.querySelector("[data-coverflow-prev]").addEventListener("click", () => move(-1));
  root.querySelector("[data-coverflow-next]").addEventListener("click", () => move(1));
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });
  track.addEventListener("pointerdown", (event) => { pointerStart = event.clientX; });
  track.addEventListener("pointerup", (event) => {
    if (pointerStart === null) return;
    const delta = event.clientX - pointerStart;
    if (Math.abs(delta) > 48) move(delta > 0 ? -1 : 1);
    pointerStart = null;
  });
  initImageCompare(track);
  render();
}
