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
import { initSiteHeader } from "./components/site-header.js";
import { initShowcaseScroll } from "./components/showcase-scroll.js";
import { initViewportDebug } from "./components/viewport-debug.js";
import { initKakaoStableViewportHeight } from "./utils/viewport-state.js";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });
initKakaoStableViewportHeight();

const runInitializer = (name, initializer) => {
  try {
    initializer();
  } catch (error) {
    // An optional motion failure must not prevent later content from rendering.
    console.error(`[landing] ${name} initialization failed`, error);
  }
};

// Reviews are content, so populate them before canvas and scroll effects.
runInitializer("review-marquee", initReviewMarquee);
runInitializer("concern-scroll", initConcernScroll);
runInitializer("brand-reveal", initBrandReveal);
runInitializer("coverflow", initCoverflow);
runInitializer("doctor-gallery", initDoctorGallery);
runInitializer("equipment-stack", initEquipmentStack);
runInitializer("evidence-scroll", initEvidenceScroll);
runInitializer("feature-visuals", initFeatureVisuals);
runInitializer("showcase-scroll", initShowcaseScroll);
runInitializer("viewport-debug", initViewportDebug);

// ScrollTrigger already refreshes on DOMContentLoaded, load, resize, and visibility changes.
// Web-font completion is the only extra layout event it cannot observe directly.
document.fonts?.ready.then(() => ScrollTrigger.refresh());

const hero = document.querySelector(".hero");
initSiteHeader({ hero });
