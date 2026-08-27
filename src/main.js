import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initBrandReveal } from "./components/brand-reveal.js";
import { initConcernScroll } from "./components/concern-scroll.js";
import { initCoverflow } from "./components/coverflow.js";
import { initDoctorGallery } from "./components/doctor-gallery.js";
import { initEquipmentStack } from "./components/equipment-stack.js";
import { initEvidenceScroll } from "./components/evidence-scroll.js";
import { initFeatureVisuals } from "./components/feature-visuals.js";
import { initReviewMarquee } from "./components/review-marquee.js";
import { initShowcaseScroll } from "./components/showcase-scroll.js";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

initConcernScroll();
initBrandReveal();
initCoverflow();
initDoctorGallery();
initEquipmentStack();
initEvidenceScroll();
initFeatureVisuals();
initReviewMarquee();
initShowcaseScroll();

let refreshFrame = 0;
const refreshScrollGeometry = () => {
  cancelAnimationFrame(refreshFrame);
  refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh(true));
};
refreshScrollGeometry();
addEventListener("load", refreshScrollGeometry, { once: true });
document.fonts?.ready.then(refreshScrollGeometry);
const eagerImages = [...document.images].filter((image) => image.loading !== "lazy");
Promise.all(eagerImages.map((image) => image.decode().catch(() => {}))).then(refreshScrollGeometry);
document.addEventListener("load", (event) => {
  if (event.target instanceof HTMLImageElement && event.target.loading === "lazy") refreshScrollGeometry();
}, true);

const heroVideo = document.querySelector(".hero-video");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const startHeroVideo = () => {
  if (!heroVideo || reducedMotion.matches) return;
  heroVideo.play().catch(() => {});
};
startHeroVideo();
heroVideo?.addEventListener("canplay", startHeroVideo, { once: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) startHeroVideo();
});
reducedMotion.addEventListener("change", ({ matches }) => {
  if (matches) heroVideo?.pause();
  else startHeroVideo();
});

const header = document.querySelector("[data-header]");
const hero = document.querySelector(".hero");
const menuButton = document.querySelector("[data-menu]");
const nav = document.querySelector("[data-nav]");
const treatmentMenu = nav?.querySelector("[data-treatment-menu]");
const treatmentToggle = nav?.querySelector("[data-treatment-toggle]");
const treatmentSubmenu = nav?.querySelector("[data-treatment-submenu]");
const pageMain = document.querySelector("main");
const pageFooter = document.querySelector("footer");
const skipLink = document.querySelector(".skip-link");
const setTreatmentMenuOpen = (open) => {
  if (!treatmentMenu || !treatmentToggle || !treatmentSubmenu) return;
  treatmentMenu.toggleAttribute("data-open", open);
  header?.toggleAttribute("data-treatment-open", open);
  treatmentToggle.setAttribute("aria-expanded", String(open));
  treatmentSubmenu.toggleAttribute("inert", !open);
};
setTreatmentMenuOpen(false);
let lastHeaderScrollY = Math.max(0, scrollY);
const headerDirectionThreshold = 6;
const updateHeader = () => {
  if (!header) return;
  const currentScrollY = Math.max(0, scrollY);
  header.toggleAttribute("data-on-light", currentScrollY > (hero?.offsetHeight || innerHeight) - 96);
  const menuOpen = nav?.hasAttribute("data-open");
  const treatmentOpen = treatmentMenu?.hasAttribute("data-open");
  const headerHasKeyboardFocus = header.contains(document.activeElement)
    && document.activeElement?.matches?.(":focus-visible");
  if (currentScrollY <= 8 || menuOpen || treatmentOpen || headerHasKeyboardFocus) {
    header.removeAttribute("data-hidden");
    lastHeaderScrollY = currentScrollY;
    return;
  }
  const scrollDelta = currentScrollY - lastHeaderScrollY;
  if (scrollDelta >= headerDirectionThreshold) {
    header.setAttribute("data-hidden", "");
    lastHeaderScrollY = currentScrollY;
  } else if (scrollDelta <= -headerDirectionThreshold) {
    header.removeAttribute("data-hidden");
    lastHeaderScrollY = currentScrollY;
  }
};
updateHeader();
addEventListener("scroll", updateHeader, { passive: true });

const setMenuOpen = (open, restoreFocus = true, focusFirstItem = false) => {
  if (!menuButton || !nav) return;
  const wasOpen = nav.hasAttribute("data-open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  nav.toggleAttribute("data-open", open);
  header?.toggleAttribute("data-menu-open", open);
  document.body.classList.toggle("menu-open", open);
  if (!open) setTreatmentMenuOpen(false);
  if (pageMain) pageMain.inert = open;
  if (pageFooter) pageFooter.inert = open;
  if (skipLink) skipLink.inert = open;
  header?.removeAttribute("data-hidden");
  if (open && focusFirstItem) window.requestAnimationFrame(() => nav.querySelector("a")?.focus());
  else if (!open && restoreFocus && wasOpen) menuButton.focus();
};

menuButton?.addEventListener("click", (event) => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true", true, event.detail === 0);
});
treatmentToggle?.addEventListener("click", () => {
  setTreatmentMenuOpen(treatmentToggle.getAttribute("aria-expanded") !== "true");
});
nav?.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  setTreatmentMenuOpen(false);
  if (nav.hasAttribute("data-open")) setMenuOpen(false, false);
});
header?.querySelector(".wordmark")?.addEventListener("click", () => {
  if (nav?.hasAttribute("data-open")) setMenuOpen(false, false);
});
addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (treatmentMenu?.hasAttribute("data-open")) {
      setTreatmentMenuOpen(false);
      treatmentToggle?.focus();
      return;
    }
    if (!nav?.hasAttribute("data-open")) return;
    setMenuOpen(false);
    return;
  }
  if (!nav?.hasAttribute("data-open")) return;
  if (event.key !== "Tab" || !header) return;
  const focusable = [...header.querySelectorAll("a[href], button:not([disabled])")]
    .filter((element) => element.getClientRects().length > 0 && !element.inert);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});
matchMedia("(min-width: 64.0625rem)").addEventListener("change", () => {
  setTreatmentMenuOpen(false);
  if (nav?.hasAttribute("data-open")) setMenuOpen(false, false);
});
treatmentMenu?.addEventListener("focusout", () => {
  requestAnimationFrame(() => {
    if (!treatmentMenu.contains(document.activeElement)) setTreatmentMenuOpen(false);
  });
});
document.addEventListener("pointerdown", (event) => {
  if (treatmentMenu?.hasAttribute("data-open") && !event.target.closest("[data-treatment-menu]")) {
    setTreatmentMenuOpen(false);
  }
});
