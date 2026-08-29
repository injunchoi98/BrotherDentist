import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard,
  getSmallViewportHeight,
} from "./utils/pin-height-guard.js";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const header = document.querySelector("[data-header]");
const hero = document.querySelector("[data-implant-hero]");
const heroFrame = hero?.querySelector("[data-implant-hero-frame]");
const heroImage = hero?.querySelector(".implant-hero-media img");
const heroTitle = hero?.querySelector("h1");
const precision = document.querySelector("[data-implant-precision]");
const precisionSticky = precision?.querySelector("[data-implant-precision-sticky]");
const precisionCard = precision?.querySelector("[data-implant-precision-card]");
const precisionImage = precisionCard?.querySelector("img");
const precisionReveal = precision?.querySelector("[data-implant-reveal]");
const precisionStage = precision?.querySelector("[data-implant-stage]");
const precisionRevealImage = precisionReveal?.querySelector(".implant-restoration-background img");
const precisionSceneProduct = precision?.querySelector("[data-implant-scene-product]");
const precisionSceneProductImage = precisionSceneProduct?.querySelector("img");
const precisionHolder = precision?.querySelector("[data-implant-holder]");
const precisionHolderImage = precisionHolder?.querySelector("img");
const precisionAmbient = precision?.querySelector("[data-implant-ambient]");
const precisionSceneShade = precision?.querySelector("[data-implant-scene-shade]");
const diagnosisCopy = precision?.querySelector('[data-implant-copy="diagnosis"]');
const benefitCopy = precision?.querySelector('[data-implant-copy="benefit"]');
const planCopy = precision?.querySelector('[data-implant-copy="plan"]');
const precisionCopies = [diagnosisCopy, benefitCopy, planCopy].filter(Boolean);

const RESTORATION_STAGE_WIDTH = 1658;
const RESTORATION_STAGE_HEIGHT = 949;

const drawProductAmbient = () => {
  if (!precisionAmbient) return;
  const context = precisionAmbient.getContext("2d");
  if (!context) return;

  const styles = getComputedStyle(precisionAmbient);
  const lightColor = styles.color;
  const shadowColor = styles.borderTopColor;
  context.clearRect(0, 0, RESTORATION_STAGE_WIDTH, RESTORATION_STAGE_HEIGHT);

  context.save();
  context.translate(570, 390);
  context.scale(1.18, 1);
  context.globalAlpha = .34;
  const halo = context.createRadialGradient(0, -24, 18, 0, -24, 310);
  halo.addColorStop(0, lightColor);
  halo.addColorStop(.46, lightColor);
  halo.addColorStop(1, "transparent");
  context.fillStyle = halo;
  context.fillRect(-360, -360, 720, 720);
  context.restore();

  context.save();
  context.translate(570, 648);
  context.scale(1, .18);
  context.globalAlpha = .24;
  const shadow = context.createRadialGradient(0, 0, 10, 0, 0, 178);
  shadow.addColorStop(0, shadowColor);
  shadow.addColorStop(.5, shadowColor);
  shadow.addColorStop(1, "transparent");
  context.fillStyle = shadow;
  context.fillRect(-190, -190, 380, 380);
  context.restore();
};

const syncRestorationStage = () => {
  if (!precisionStage || !precisionSticky) return;
  const width = precisionSticky.clientWidth;
  const height = precisionSticky.clientHeight;
  if (!width || !height) return;

  const scale = Math.max(
    width / RESTORATION_STAGE_WIDTH,
    height / RESTORATION_STAGE_HEIGHT,
  );
  precisionStage.style.setProperty("--restoration-stage-scale", scale.toFixed(6));
  precisionStage.style.setProperty(
    "--restoration-stage-x",
    `${(width - RESTORATION_STAGE_WIDTH * scale) / 2}px`,
  );
  precisionStage.style.setProperty(
    "--restoration-stage-y",
    `${(height - RESTORATION_STAGE_HEIGHT * scale) / 2}px`,
  );
};

const initRestorationStage = () => {
  if (!precisionStage || !precisionSticky) return;
  drawProductAmbient();
  syncRestorationStage();
  new ResizeObserver(syncRestorationStage).observe(precisionSticky);
};

const clearSceneStyles = () => {
  gsap.set([
    precisionCard,
    precisionImage,
    precisionReveal,
    precisionRevealImage,
    precisionSceneProduct,
    precisionSceneProductImage,
    precisionHolder,
    precisionHolderImage,
    precisionAmbient,
    precisionSceneShade,
    ...precisionCopies,
  ].filter(Boolean), {
        clearProps: "top,right,bottom,left,borderRadius,clipPath,opacity,visibility,transform,scale,rotation,transformOrigin,xPercent,yPercent",
  });
};

const initHeroExpansion = () => {
  if (!hero || !heroFrame || !heroImage || !heroTitle) return;

  createPinHeightGuard({
    section: hero,
    allowMobile: true,
    minimumHeightRem: ({ isMobile }) => calculatePinMinimumHeightRem({
      headerHeightPixels: header?.offsetHeight || 0,
      contentHeightPixels: heroTitle.offsetHeight,
      topSafetyRem: isMobile ? 5 : 7,
      bottomSafetyRem: isMobile ? 3 : 5,
    }),
    onEnable: () => {
      const compact = matchMedia("(max-width: 47.999rem)").matches;
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "implant-hero-expansion",
          trigger: hero,
          start: "top top",
          end: () => `+=${Math.round(getSmallViewportHeight() * 1.2)}`,
          scrub: .65,
          invalidateOnRefresh: true,
        },
      });

      timeline.addLabel("contained", 0);
      timeline.fromTo(heroFrame, {
        top: () => compact ? (header?.offsetHeight || 56) : 64,
        right: compact ? 20 : 16,
        bottom: compact ? 20 : 24,
        left: compact ? 20 : 16,
        borderRadius: 40,
      }, {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: 0,
        duration: 1,
      }, "contained");
      timeline.fromTo(heroImage, { scale: 1.2 }, { scale: 1, duration: 1 }, "contained");
      timeline.to({}, { duration: .25 });

      return () => {
        timeline.scrollTrigger?.kill();
        timeline.kill();
        gsap.set([heroFrame, heroImage], { clearProps: "top,right,bottom,left,borderRadius,transform" });
      };
    },
    onDisable: () => gsap.set([heroFrame, heroImage], { clearProps: "top,right,bottom,left,borderRadius,transform" }),
  });
};

const initPrecisionSequence = () => {
  if (!precision || !precisionSticky || !precisionCard || !precisionImage || !precisionReveal || !precisionStage || !precisionRevealImage || !precisionSceneProduct || !precisionSceneProductImage || !precisionHolder || !precisionHolderImage || !precisionAmbient || !precisionSceneShade || precisionCopies.length !== 3) return;

  const desktopMedia = matchMedia("(min-width: 64.0625rem)");
  let disposeGuard = null;

  const syncPrecisionLayout = () => {
    disposeGuard?.();
    disposeGuard = null;
    clearSceneStyles();

    if (!desktopMedia.matches) return;

    disposeGuard = createPinHeightGuard({
    section: precision,
    allowMobile: false,
    minimumHeightRem: () => calculatePinMinimumHeightRem({
      headerHeightPixels: header?.offsetHeight || 0,
      contentHeightPixels: Math.max(...precisionCopies.map((copy) => copy.offsetHeight)),
      topSafetyRem: 6,
      bottomSafetyRem: 6,
    }),
    onEnable: () => {
      const copyX = 0;
      const copyY = -50;
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "implant-photo-sequence",
          trigger: precision,
          start: "top top",
          end: "bottom bottom",
          scrub: .7,
          invalidateOnRefresh: true,
        },
      });

      gsap.set(diagnosisCopy, { autoAlpha: 1, xPercent: copyX, yPercent: copyY });
      gsap.set([benefitCopy, planCopy], { autoAlpha: 0, xPercent: copyX, yPercent: copyY });
      gsap.set(precisionCard, { autoAlpha: 1, yPercent: 0 });
      gsap.set(precisionReveal, {
        autoAlpha: 1,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: 0,
        clipPath: "inset(0px round 0px)",
        yPercent: 100,
      });
      gsap.set(precisionHolder, {
        autoAlpha: 1,
        xPercent: 0,
        yPercent: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      });
      gsap.set(precisionSceneProduct, {
        autoAlpha: 1,
        xPercent: 0,
        yPercent: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        transformOrigin: "34.35% 41.25%",
      });
      gsap.set(precisionAmbient, { autoAlpha: .2 });
      gsap.set(precisionSceneShade, { autoAlpha: 1 });

      timeline.addLabel("diagnosis", 0);
      timeline.to(precisionImage, {
        scale: 1.075,
        xPercent: 0,
        duration: .9,
      }, "diagnosis");
      timeline.to({}, { duration: .48 });

      timeline.addLabel("photo-rise", ">");
      timeline.to(diagnosisCopy, {
        autoAlpha: 0,
        yPercent: copyY,
        duration: .28,
      }, "photo-rise+=.08");

      timeline.to(precisionReveal, {
        yPercent: 0,
        duration: 1.3,
      }, "photo-rise");

      timeline.fromTo(benefitCopy, {
        autoAlpha: 0,
        xPercent: copyX,
        yPercent: copyY,
      }, {
        autoAlpha: 1,
        xPercent: copyX,
        yPercent: copyY,
        duration: .42,
      }, "photo-rise+=.82");
      timeline.to({}, { duration: .9 });

      timeline.addLabel("product-focus", ">");
      timeline.to(benefitCopy, {
        autoAlpha: 0,
        yPercent: copyY,
        duration: .32,
      }, "product-focus");
      timeline.to(precisionHolder, {
        autoAlpha: 0,
        yPercent: 5,
        duration: 1.05,
      }, "product-focus");
      timeline.to(precisionSceneProduct, {
        scale: 1.08,
        duration: 1.05,
      }, "product-focus");
      timeline.to(precisionAmbient, {
        autoAlpha: 1,
        duration: 1.05,
      }, "product-focus");
      timeline.to(precisionSceneShade, {
        opacity: .16,
        duration: 1.05,
      }, "product-focus");
      timeline.fromTo(planCopy, {
        autoAlpha: 0,
        xPercent: copyX,
        yPercent: copyY,
      }, {
        autoAlpha: 1,
        xPercent: copyX,
        yPercent: copyY,
        duration: .52,
      }, "product-focus+=.5");
      timeline.to({}, { duration: .9 });

      return () => {
        timeline.scrollTrigger?.kill();
        timeline.kill();
        clearSceneStyles();
      };
    },
    onDisable: clearSceneStyles,
  });
  };

  syncPrecisionLayout();
  desktopMedia.addEventListener("change", syncPrecisionLayout);
};

const initHeader = () => {
  const menuButton = document.querySelector("[data-menu]");
  const nav = document.querySelector("[data-nav]");
  const treatmentMenu = nav?.querySelector("[data-treatment-menu]");
  const treatmentToggle = nav?.querySelector("[data-treatment-toggle]");
  const treatmentSubmenu = nav?.querySelector("[data-treatment-submenu]");
  const pageMain = document.querySelector("main");
  const skipLink = document.querySelector(".skip-link");

  const setTreatmentOpen = (open) => {
    if (!treatmentMenu || !treatmentToggle || !treatmentSubmenu) return;
    treatmentMenu.toggleAttribute("data-open", open);
    header?.toggleAttribute("data-treatment-open", open);
    treatmentToggle.setAttribute("aria-expanded", String(open));
    treatmentSubmenu.toggleAttribute("inert", !open);
  };

  const setMenuOpen = (open, restoreFocus = true, focusFirstItem = false) => {
    if (!menuButton || !nav) return;
    const wasOpen = nav.hasAttribute("data-open");
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    nav.toggleAttribute("data-open", open);
    header?.toggleAttribute("data-menu-open", open);
    document.body.classList.toggle("menu-open", open);
    if (!open) setTreatmentOpen(false);
    if (pageMain) pageMain.inert = open;
    if (skipLink) skipLink.inert = open;
    if (open && focusFirstItem) requestAnimationFrame(() => nav.querySelector("a")?.focus());
    else if (!open && restoreFocus && wasOpen) menuButton.focus();
  };

  setTreatmentOpen(false);
  menuButton?.addEventListener("click", (event) => setMenuOpen(!nav?.hasAttribute("data-open"), true, event.detail === 0));
  treatmentToggle?.addEventListener("click", () => setTreatmentOpen(!treatmentMenu?.hasAttribute("data-open")));
  nav?.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    setTreatmentOpen(false);
    if (nav.hasAttribute("data-open")) setMenuOpen(false, false);
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (treatmentMenu?.hasAttribute("data-open")) {
        setTreatmentOpen(false);
        treatmentToggle?.focus();
      } else if (nav?.hasAttribute("data-open")) {
        setMenuOpen(false);
      }
      return;
    }
    if (event.key !== "Tab" || !nav?.hasAttribute("data-open") || !header) return;
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
  treatmentMenu?.addEventListener("focusout", () => requestAnimationFrame(() => {
    if (!treatmentMenu.contains(document.activeElement)) setTreatmentOpen(false);
  }));
  document.addEventListener("pointerdown", (event) => {
    if (treatmentMenu?.hasAttribute("data-open") && !event.target.closest("[data-treatment-menu]")) {
      setTreatmentOpen(false);
    }
  });
  matchMedia("(min-width: 64.0625rem)").addEventListener("change", () => {
    setTreatmentOpen(false);
    if (nav?.hasAttribute("data-open")) setMenuOpen(false, false);
  });

  const syncHeader = () => {
    header?.toggleAttribute("data-on-light", scrollY > (hero?.offsetHeight || innerHeight) - 96);
  };
  syncHeader();
  addEventListener("scroll", syncHeader, { passive: true });
};

initHeader();
initHeroExpansion();
initRestorationStage();
initPrecisionSequence();

Promise.all([
  document.fonts?.ready,
  ...[heroImage, precisionImage, precisionRevealImage, precisionSceneProductImage, precisionHolderImage]
    .filter(Boolean)
    .map((image) => image.decode?.().catch(() => {})),
]).then(() => ScrollTrigger.refresh());
