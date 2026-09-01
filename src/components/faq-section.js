let faqInstance = 0;

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

export function initFaqSection(root, { label, title, subtitle, items } = {}) {
  if (!root || !items?.length) return;

  const instance = ++faqInstance;
  const headingId = `faq-heading-${instance}`;
  const inner = createElement("div", "faq-section-inner");
  const heading = createElement("header", "faq-section-heading");
  const eyebrow = createElement("p", "faq-section-label", label);
  const titleElement = createElement("h2", "landing-heading-3", title);
  const subtitleElement = createElement("p", "faq-section-subtitle", subtitle);
  const list = createElement("div", "faq-list");

  titleElement.id = headingId;
  root.setAttribute("aria-labelledby", headingId);
  heading.append(eyebrow, titleElement, subtitleElement);

  items.forEach((item, index) => {
    const itemElement = createElement("article", "faq-item");
    const trigger = createElement("button", "faq-trigger");
    const question = createElement("span", "faq-question", item.question);
    const icon = createElement("span", "faq-icon");
    const panel = createElement("div", "faq-panel");
    const answer = createElement("p", "faq-answer", item.answer);
    const triggerId = `faq-trigger-${instance}-${index}`;
    const panelId = `faq-panel-${instance}-${index}`;

    trigger.type = "button";
    trigger.id = triggerId;
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", panelId);
    icon.setAttribute("aria-hidden", "true");
    panel.id = panelId;
    panel.hidden = true;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", triggerId);

    trigger.append(question, icon);
    panel.append(answer);
    itemElement.append(trigger, panel);
    list.append(itemElement);
  });

  inner.append(heading, list);
  root.replaceChildren(inner);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animations = new WeakMap();

  const setOpen = (trigger, open) => {
    const item = trigger.closest(".faq-item");
    const panel = item.querySelector(".faq-panel");
    animations.get(panel)?.cancel();
    trigger.setAttribute("aria-expanded", String(open));
    item.toggleAttribute("data-open", open);

    if (reducedMotion.matches) {
      panel.hidden = !open;
      return;
    }

    if (open) panel.hidden = false;
    const animation = panel.animate(
      open
        ? [{ height: "0px", opacity: 0 }, { height: `${panel.scrollHeight}px`, opacity: 1 }]
        : [{ height: `${panel.scrollHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }],
      { duration: 250, easing: "ease" },
    );
    animations.set(panel, animation);
    animation.finished
      .then(() => {
        if (trigger.getAttribute("aria-expanded") === "false") panel.hidden = true;
      })
      .catch(() => {});
  };

  list.addEventListener("click", (event) => {
    const trigger = event.target.closest(".faq-trigger");
    if (!trigger) return;
    const shouldOpen = trigger.getAttribute("aria-expanded") !== "true";
    list.querySelectorAll('.faq-trigger[aria-expanded="true"]').forEach((openTrigger) => {
      if (openTrigger !== trigger) setOpen(openTrigger, false);
    });
    setOpen(trigger, shouldOpen);
  });
}
