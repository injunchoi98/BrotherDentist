export function initBrandReveal() {
  const section = document.querySelector("[data-brand-reveal]");
  if (!section) return;
  const mask = section.querySelector("[data-brand-mask]");

  const update = () => {
    const rect = section.getBoundingClientRect();
    const distance = Math.max(1, section.offsetHeight - innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / distance));
    const start = 0.08;
    const growth = Math.max(0, (progress - start) / (1 - start));
    const eased = growth * growth * (3 - (2 * growth));
    mask.style.setProperty("--reveal", eased.toFixed(4));
    mask.classList.toggle("is-visible", progress > start);
  };
  update();
  addEventListener("scroll", update, { passive: true });
}
