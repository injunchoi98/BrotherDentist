import { concerns } from "../data.js";

export function initConcernScroll() {
  const section = document.querySelector("[data-concern]");
  if (!section) return;
  const eyebrow = section.querySelector("[data-concern-eyebrow]");
  const title = section.querySelector("[data-concern-title]");
  const copy = section.querySelector("[data-concern-copy]");
  const patient = section.querySelector("[data-patient]");
  const dots = [...section.querySelectorAll("[data-concern-dot]")];
  let current = -1;

  const render = (index) => {
    if (index === current) return;
    current = index;
    const item = concerns[index];
    section.classList.add("is-changing");
    window.setTimeout(() => {
      eyebrow.textContent = item.eyebrow;
      title.textContent = item.title;
      copy.textContent = item.copy;
      patient.dataset.pose = String(item.pose);
      dots.forEach((dot, i) => dot.toggleAttribute("aria-current", i === index));
      section.classList.remove("is-changing");
    }, 130);
  };

  const update = () => {
    const rect = section.getBoundingClientRect();
    const distance = Math.max(1, section.offsetHeight - innerHeight);
    const progress = Math.min(0.999, Math.max(0, -rect.top / distance));
    render(Math.min(concerns.length - 1, Math.floor(progress * concerns.length)));
  };
  update();
  addEventListener("scroll", update, { passive: true });
}
