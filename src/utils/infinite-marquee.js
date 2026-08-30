const SPEED_DURATION = {
  fast: "20s",
  normal: "40s",
  slow: "80s"
};

const makeDuplicateInert = (element) => {
  element.setAttribute("aria-hidden", "true");
  element.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  element.querySelectorAll("a, button, input, select, textarea, [tabindex]")
    .forEach((node) => node.setAttribute("tabindex", "-1"));
};

/**
 * Converts the existing children of a flex track into a seamless marquee.
 *
 * This is the static-site equivalent of the supplied InfiniteMovingCards
 * component: content is authored once, cloned once after mount, and moved by
 * CSS. The duplicate copy is hidden from assistive technology so reviews and
 * material names are not announced twice.
 */
export function initInfiniteMarquee({
  track,
  direction = "left",
  speed = "fast",
  pauseOnHover = true
}) {
  if (!track || track.hasAttribute("data-infinite-ready")) return;

  const originalItems = [...track.children];
  if (!originalItems.length) return;

  originalItems.forEach((item) => {
    const duplicate = item.cloneNode(true);
    makeDuplicateInert(duplicate);
    track.append(duplicate);
  });

  track.style.setProperty(
    "--infinite-direction",
    direction === "left" ? "normal" : "reverse"
  );
  track.style.setProperty(
    "--infinite-duration",
    SPEED_DURATION[speed] || SPEED_DURATION.fast
  );
  track.toggleAttribute("data-pause-on-hover", pauseOnHover);
  track.setAttribute("data-infinite-ready", "");
}
