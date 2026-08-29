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
const precisionProductPlane = precision?.querySelector("[data-implant-product-plane]");
const precisionProduct = precision?.querySelector("[data-implant-product]");
const precisionProductImage = precisionProduct?.querySelector("img");
const precisionHolderPlane = precision?.querySelector("[data-implant-holder-plane]");
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
const PRODUCT_SOURCE_WIDTH = 480;
const PRODUCT_SOURCE_HEIGHT = 1417;
const PRODUCT_REFERENCE_WIDTH = 262;
const PRODUCT_REFERENCE_HEIGHT = PRODUCT_REFERENCE_WIDTH * PRODUCT_SOURCE_HEIGHT / PRODUCT_SOURCE_WIDTH;
const HOLDER_REFERENCE_WIDTH = 247;
const ASSEMBLY_MAX_SCALE = .8;
const ASSEMBLY_JOIN_OFFSET_Y = 476;
const ASSEMBLY_ANCHOR_X = .656;

const drawProductAmbient = ({
  width,
  height,
  productLeft,
  productTop,
  productWidth,
  productHeight,
}) => {
  if (!precisionAmbient) return;
  const context = precisionAmbient.getContext("2d");
  if (!context) return;

  const pixelRatio = Math.min(devicePixelRatio || 1, 2);
  precisionAmbient.width = Math.round(width * pixelRatio);
  precisionAmbient.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const styles = getComputedStyle(precisionAmbient);
  const lightColor = styles.color;
  const shadowColor = styles.borderTopColor;
  const centerX = productLeft + productWidth / 2;
  const centerY = productTop + productHeight * .43;
  context.clearRect(0, 0, width, height);

  context.save();
  context.translate(centerX, centerY);
  context.scale(1.22, 1);
  context.globalAlpha = .3;
  const haloRadius = Math.max(productWidth * 1.45, 180);
  const halo = context.createRadialGradient(0, 0, 12, 0, 0, haloRadius);
  halo.addColorStop(0, lightColor);
  halo.addColorStop(.42, lightColor);
  halo.addColorStop(1, "transparent");
  context.fillStyle = halo;
  context.fillRect(-haloRadius, -haloRadius, haloRadius * 2, haloRadius * 2);
  context.restore();

  context.save();
  context.translate(centerX, productTop + productHeight * .96);
  context.scale(1, .12);
  context.globalAlpha = .08;
  const shadow = context.createRadialGradient(0, 0, 8, 0, 0, productWidth * .72);
  shadow.addColorStop(0, shadowColor);
  shadow.addColorStop(.35, shadowColor);
  shadow.addColorStop(1, "transparent");
  context.fillStyle = shadow;
  context.fillRect(-productWidth, -productWidth, productWidth * 2, productWidth * 2);
  context.restore();

  context.save();
  context.fillStyle = lightColor;
  for (let index = 0; index < 42; index += 1) {
    const angle = index * 2.399963;
    const radius = productWidth * (.7 + (index % 9) * .115);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius * .72;
    context.globalAlpha = .018 + (index % 4) * .006;
    context.beginPath();
    context.arc(x, y, .45 + (index % 3) * .22, 0, Math.PI * 2);
    context.fill();
  }
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

  const topSafe = (header?.offsetHeight || 64) + 32;
  const bottomSafe = 44;
  const availableHeight = Math.max(1, height - topSafe - bottomSafe);
  const availableWidth = Math.max(1, width * .28);
  const assemblyScale = Math.min(
    ASSEMBLY_MAX_SCALE,
    availableHeight / PRODUCT_REFERENCE_HEIGHT,
    availableWidth / PRODUCT_REFERENCE_WIDTH,
  );
  const productWidth = PRODUCT_REFERENCE_WIDTH * assemblyScale;
  const productHeight = PRODUCT_REFERENCE_HEIGHT * assemblyScale;
  const holderWidth = HOLDER_REFERENCE_WIDTH * assemblyScale;
  const centerX = Math.min(
    width - Math.max(40, productWidth / 2),
    Math.max(productWidth / 2 + 40, width * ASSEMBLY_ANCHOR_X),
  );
  const productLeft = centerX - productWidth / 2;
  const productTop = topSafe + Math.max(0, (availableHeight - productHeight) / 2);
  const holderLeft = centerX - holderWidth / 2;
  const holderTop = productTop + ASSEMBLY_JOIN_OFFSET_Y * assemblyScale;

  precisionSticky.style.setProperty("--implant-product-left", `${productLeft.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-product-top", `${productTop.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-product-width", `${productWidth.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-holder-left", `${holderLeft.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-holder-top", `${holderTop.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-holder-width", `${holderWidth.toFixed(3)}px`);
  precisionSticky.dataset.implantAssemblyScale = assemblyScale.toFixed(6);

  drawProductAmbient({
    width,
    height,
    productLeft,
    productTop,
    productWidth,
    productHeight,
  });
};

const initRestorationStage = () => {
  if (!precisionStage || !precisionSticky) return;
  syncRestorationStage();
  new ResizeObserver(syncRestorationStage).observe(precisionSticky);
};

const clearSceneStyles = () => {
  gsap.set([
    precisionCard,
    precisionImage,
    precisionReveal,
    precisionRevealImage,
    precisionProductPlane,
    precisionHolderPlane,
    precisionAmbient,
    precisionSceneShade,
    ...precisionCopies,
  ].filter(Boolean), {
        clearProps: "top,right,bottom,left,borderRadius,clipPath,opacity,visibility,transform,x,y,xPercent,yPercent",
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
  if (!precision || !precisionSticky || !precisionCard || !precisionImage || !precisionReveal || !precisionStage || !precisionRevealImage || !precisionProductPlane || !precisionProduct || !precisionProductImage || !precisionHolderPlane || !precisionHolder || !precisionHolderImage || !precisionAmbient || !precisionSceneShade || precisionCopies.length !== 3) return;

  const desktopMedia = matchMedia("(min-width: 64.0625rem)");
  let disposeGuard = null;

  const getFrameClipPath = () => {
    const width = precisionSticky.clientWidth;
    const height = precisionSticky.clientHeight;
    const inlineInset = Math.round(Math.min(180, Math.max(56, width * .085)));
    const blockInset = Math.round(Math.min(152, Math.max(72, height * .16)));
    const radius = Math.round(Math.min(80, Math.max(40, width * .04)));
    return `inset(${blockInset}px ${inlineInset}px round ${radius}px)`;
  };

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
            onRefreshInit: syncRestorationStage,
          },
        });

        syncRestorationStage();
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
        gsap.set(precisionProductPlane, {
          clipPath: "inset(100% 0 0)",
        });
        gsap.set(precisionHolderPlane, {
          clipPath: "inset(0px round 0px)",
          yPercent: 100,
        });
        gsap.set(precisionAmbient, { opacity: .2 });
        gsap.set(precisionSceneShade, { autoAlpha: 1 });

        timeline.addLabel("diagnosis", 0);
        timeline.to(precisionImage, {
          scale: 1.075,
          xPercent: 0,
          duration: .9,
        }, "diagnosis");
        timeline.to({}, { duration: .48 });

        timeline.addLabel("implant-scene", ">");
        timeline.to(diagnosisCopy, {
          autoAlpha: 0,
          yPercent: copyY,
          duration: .28,
        }, "implant-scene+=.08");
        timeline.to([precisionReveal, precisionHolderPlane], {
          yPercent: 0,
          duration: 1.3,
        }, "implant-scene");
        timeline.to(precisionProductPlane, {
          clipPath: "inset(0% 0 0)",
          duration: 1.3,
        }, "implant-scene");
        timeline.fromTo(benefitCopy, {
          autoAlpha: 0,
          xPercent: copyX,
          yPercent: copyY,
        }, {
          autoAlpha: 1,
          xPercent: copyX,
          yPercent: copyY,
          duration: .42,
        }, "implant-scene+=.82");
        timeline.to({}, { duration: .72 });

        timeline.addLabel("frame-shrink", ">");
        timeline.set(precisionCard, { autoAlpha: 0 }, "frame-shrink");
        timeline.to(benefitCopy, {
          autoAlpha: 0,
          yPercent: copyY,
          duration: .32,
        }, "frame-shrink");
        timeline.to([precisionReveal, precisionHolderPlane], {
          clipPath: getFrameClipPath,
          duration: 1.15,
        }, "frame-shrink");
        timeline.to(precisionAmbient, {
          opacity: 1,
          duration: 1.15,
        }, "frame-shrink");

        timeline.addLabel("frame-hold", ">");
        timeline.to({}, { duration: .48 });

        timeline.addLabel("frame-exit", ">");
        timeline.to([precisionReveal, precisionHolderPlane], {
          yPercent: -100,
          duration: 1.05,
        }, "frame-exit");

        timeline.addLabel("final-copy", ">");
        timeline.fromTo(planCopy, {
          autoAlpha: 0,
          xPercent: copyX,
          yPercent: copyY,
        }, {
          autoAlpha: 1,
          xPercent: copyX,
          yPercent: copyY,
          duration: .52,
        }, "final-copy");
        timeline.to({}, { duration: .78 });

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
  ...[heroImage, precisionImage, precisionRevealImage, precisionProductImage, precisionHolderImage]
    .filter(Boolean)
    .map((image) => image.decode?.().catch(() => {})),
]).then(() => ScrollTrigger.refresh());
