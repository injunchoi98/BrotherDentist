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
    const panelInner = createElement("div", "faq-panel-inner");
    const answer = createElement("p", "faq-answer", item.answer);
    const triggerId = `faq-trigger-${instance}-${index}`;
    const panelId = `faq-panel-${instance}-${index}`;

    trigger.type = "button";
    trigger.id = triggerId;
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", panelId);
    icon.setAttribute("aria-hidden", "true");
    panel.id = panelId;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", triggerId);
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;

    trigger.append(question, icon);
    panelInner.append(answer);
    panel.append(panelInner);
    itemElement.append(trigger, panel);
    list.append(itemElement);
  });

  inner.append(heading, list);
  root.replaceChildren(inner);

  const setOpen = (trigger, open) => {
    const item = trigger.closest(".faq-item");
    const panel = item.querySelector(".faq-panel");
    trigger.setAttribute("aria-expanded", String(open));
    item.toggleAttribute("data-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    panel.inert = !open;
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
