import { initBrandReveal } from "./components/brand-reveal.js";
import { initConcernScroll } from "./components/concern-scroll.js";
import { initCoverflow } from "./components/coverflow.js";
import { initDoctorGallery } from "./components/doctor-gallery.js";
import { initReviewMarquee } from "./components/review-marquee.js";

initConcernScroll();
initBrandReveal();
initCoverflow();
initDoctorGallery();
initReviewMarquee();

const header = document.querySelector("[data-header]");
const hero = document.querySelector(".hero");
const updateHeader = () => header?.toggleAttribute("data-on-light", scrollY > (hero?.offsetHeight || innerHeight) - 96);
updateHeader();
addEventListener("scroll", updateHeader, { passive: true });

document.querySelector("[data-menu]")?.addEventListener("click", (event) => {
  const nav = document.querySelector("[data-nav]");
  const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
  event.currentTarget.setAttribute("aria-expanded", String(!expanded));
  nav.toggleAttribute("data-open", !expanded);
});
