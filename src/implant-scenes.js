import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initSiteHeader } from "./components/site-header.js";
import { initImplantDigitalSequence } from "./components/implant-digital-sequence.js";
import { initCoverflow } from "./components/coverflow.js";
import { initFaqSection } from "./components/faq-section.js";
import { implantCases, implantFaqs } from "./data.js";
import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard,
  getSmallViewportHeight,
} from "./utils/pin-height-guard.js";
import { initKakaoStableViewportHeight } from "./utils/viewport-state.js";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });
initKakaoStableViewportHeight();

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
const precisionRevealContent = precisionReveal?.querySelector("[data-implant-scene-content]");
const precisionStage = precision?.querySelector("[data-implant-stage]");
const precisionProductStage = precision?.querySelector("[data-implant-product-stage]");
const precisionRevealImage = precisionReveal?.querySelector(".implant-restoration-scene img");
const precisionLightPlane = precision?.querySelector("[data-implant-light-plane]");
const precisionProductPlane = precision?.querySelector("[data-implant-product-plane]");
const precisionProduct = precision?.querySelector("[data-implant-product]");
const precisionProductImage = precisionProduct?.querySelector("img");
const precisionAmbient = precision?.querySelector("[data-implant-ambient]");
const diagnosisCopy = precision?.querySelector('[data-implant-copy="diagnosis"]');
const benefitCopy = precision?.querySelector('[data-implant-copy="benefit"]');
const planCopy = precision?.querySelector('[data-implant-copy="plan"]');
const precisionCopies = [diagnosisCopy, benefitCopy, planCopy].filter(Boolean);

const RESTORATION_STAGE_WIDTH = 1658;
const RESTORATION_STAGE_HEIGHT = 949;
const PRODUCT_MASTER_LEFT = 1979 / 2;
const PRODUCT_MASTER_TOP = 398 / 2;
const PRODUCT_MASTER_WIDTH = 386 / 2;
const PRODUCT_MASTER_HEIGHT = 955 / 2;

const initProductAmbient = () => {
  if (!precisionAmbient) return;
  const context = precisionAmbient.getContext("2d");
  if (!context) return;

  const desktopMedia = matchMedia("(min-width: 64rem)");
  const particles = [];
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let visible = true;
  let animationFrame = 0;
  let particleColor = "";

  const random = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);

  const createParticles = () => {
    particles.length = 0;
    for (let index = 0; index < 500; index += 1) {
      particles.push({
        baseX: random(0, width),
        baseY: random(0, height),
        scatterX: 0,
        scatterY: 0,
        radius: random(1, 2.6),
        opacity: random(.2, .55),
        speedX: random(-.08, .08),
        speedY: random(.05, .18),
        phase: random(0, Math.PI * 2),
        waveSize: random(2, 8),
      });
    }
  };

  const resize = () => {
    const bounds = precisionAmbient.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    if (!width || !height) return;
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);
    precisionAmbient.width = Math.round(width * pixelRatio);
    precisionAmbient.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    particleColor = getComputedStyle(precisionAmbient).color;
    createParticles();
  };

  const stop = () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  const render = (time) => {
    if (!desktopMedia.matches || !visible || !width || !height) {
      stop();
      return;
    }

    context.clearRect(0, 0, width, height);
    context.fillStyle = particleColor;

    particles.forEach((particle) => {
      particle.baseX += particle.speedX;
      particle.baseY += particle.speedY;
      if (particle.baseX < -4) particle.baseX = width + 4;
      if (particle.baseX > width + 4) particle.baseX = -4;
      if (particle.baseY < -4) particle.baseY = height + 4;
      if (particle.baseY > height + 4) particle.baseY = -4;

      const waveX = Math.sin(time * .001 + particle.phase) * particle.waveSize;
      const currentX = particle.baseX + waveX + particle.scatterX;
      const currentY = particle.baseY + particle.scatterY;
      let targetScatterX = 0;
      let targetScatterY = 0;
      let smoothing = .08;

      if (pointer.active) {
        const deltaX = currentX - pointer.x;
        const deltaY = currentY - pointer.y;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance > 0 && distance < 150) {
          const force = 72 * ((1 - distance / 150) ** 2);
          targetScatterX = deltaX / distance * force;
          targetScatterY = deltaY / distance * force;
          smoothing = .12;
        }
      }

      particle.scatterX += (targetScatterX - particle.scatterX) * smoothing;
      particle.scatterY += (targetScatterY - particle.scatterY) * smoothing;
      context.globalAlpha = particle.opacity;
      context.beginPath();
      context.arc(
        particle.baseX + waveX + particle.scatterX,
        particle.baseY + particle.scatterY,
        particle.radius,
        0,
        Math.PI * 2,
      );
      context.fill();
    });

    context.globalAlpha = 1;
    animationFrame = requestAnimationFrame(render);
  };

  const start = () => {
    if (!animationFrame && desktopMedia.matches && visible) {
      animationFrame = requestAnimationFrame(render);
    }
  };

  const handlePointerMove = (event) => {
    const bounds = precisionAmbient.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  };

  const handlePointerReset = () => {
    pointer.active = false;
  };

  new ResizeObserver(() => {
    resize();
    start();
  }).observe(precisionAmbient);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
    else stop();
  }).observe(precisionAmbient);
  desktopMedia.addEventListener("change", () => {
    resize();
    start();
  });
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("blur", handlePointerReset);
  document.addEventListener("pointerleave", handlePointerReset);
  resize();
  start();
};

const syncRestorationStage = () => {
  if (!precisionStage || !precisionSticky) return;
  const width = precisionSticky.clientWidth;
  const height = precisionSticky.clientHeight;
  if (!width || !height) return;

  const scale = Math.max(
    width / RESTORATION_STAGE_WIDTH,
    height / RESTORATION_STAGE_HEIGHT,
  ) * 1.002;
  precisionSticky.style.setProperty("--restoration-stage-scale", scale.toFixed(6));
  precisionSticky.style.setProperty(
    "--restoration-stage-x",
    `${(width - RESTORATION_STAGE_WIDTH * scale) / 2}px`,
  );
  precisionSticky.style.setProperty(
    "--restoration-stage-y",
    `${(height - RESTORATION_STAGE_HEIGHT * scale) / 2}px`,
  );

  const stageX = (width - RESTORATION_STAGE_WIDTH * scale) / 2;
  const stageY = (height - RESTORATION_STAGE_HEIGHT * scale) / 2;
  const productLeft = stageX + PRODUCT_MASTER_LEFT * scale;
  const productTop = stageY + PRODUCT_MASTER_TOP * scale;
  const productWidth = PRODUCT_MASTER_WIDTH * scale;
  const productHeight = PRODUCT_MASTER_HEIGHT * scale;
  const lightWidth = productWidth * 2.7;
  const lightLeft = productLeft - productWidth * .85;
  const lightTop = productTop + productHeight * .62;
  const shadowWidth = productWidth * 754 / 677;
  const shadowHeight = shadowWidth * 258 / 754;
  const shadowLeft = productLeft + productWidth - shadowWidth;
  const shadowTop = productTop + productHeight - shadowHeight * .4;

  precisionSticky.style.setProperty("--implant-light-left", `${lightLeft.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-light-top", `${lightTop.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-light-width", `${lightWidth.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-shadow-left", `${shadowLeft.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-shadow-top", `${shadowTop.toFixed(3)}px`);
  precisionSticky.style.setProperty("--implant-shadow-width", `${shadowWidth.toFixed(3)}px`);
  precisionSticky.dataset.implantSceneScale = scale.toFixed(6);
};

const initRestorationStage = () => {
  if (!precisionStage || !precisionSticky) return;
  syncRestorationStage();
  new ResizeObserver(syncRestorationStage).observe(precisionSticky);
  initProductAmbient();
};

const clearSceneStyles = () => {
  gsap.set([
    precisionCard,
    precisionImage,
    precisionReveal,
    precisionRevealContent,
    precisionRevealImage,
    precisionLightPlane,
    precisionProductPlane,
    precisionAmbient,
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
  if (!precision || !precisionSticky || !precisionCard || !precisionImage || !precisionReveal || !precisionRevealContent || !precisionStage || !precisionProductStage || !precisionRevealImage || !precisionLightPlane || !precisionProductPlane || !precisionProduct || !precisionProductImage || !precisionAmbient || precisionCopies.length !== 3) return;

  const sequenceMedia = matchMedia("(min-width: 40rem)");
  const tabletSequenceMedia = matchMedia("(max-width: 64rem)");
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

    if (!sequenceMedia.matches) return;

    disposeGuard = createPinHeightGuard({
      section: precision,
      // Small tablets still use the pinned sequence. The width media query
      // above keeps this opt-in away from phone layouts, while the shared
      // height guard and reduced-motion preference remain authoritative.
      allowMobile: true,
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
        gsap.set(precisionRevealContent, { yPercent: 0 });
        gsap.set(precisionProductPlane, {
          yPercent: 100,
        });
        gsap.set(precisionLightPlane, {
          yPercent: 100,
        });
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
        timeline.to([precisionReveal, precisionLightPlane, precisionProductPlane], {
          yPercent: 0,
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

        if (tabletSequenceMedia.matches) {
          // On tablets the image remains full bleed. Keep only a short reading
          // beat here instead of spending scroll distance on the desktop-only
          // inset/rounded-card transition.
          timeline.addLabel("scene-hold", ">");
          timeline.set(precisionCard, { autoAlpha: 0 }, "scene-hold");
          timeline.to({}, { duration: .48 });
        } else {
          timeline.addLabel("frame-shrink", ">");
          timeline.set(precisionCard, { autoAlpha: 0 }, "frame-shrink");
          timeline.to(precisionReveal, {
            clipPath: getFrameClipPath,
            duration: 1.15,
          }, "frame-shrink");

          timeline.addLabel("frame-hold", ">");
          timeline.to({}, { duration: .48 });
        }

        timeline.addLabel("frame-exit", ">");
        timeline.to(precisionReveal, {
          yPercent: -100,
          duration: 1.05,
        }, "frame-exit");
        timeline.to(precisionRevealContent, {
          yPercent: 100,
          duration: 1.05,
        }, "frame-exit");
        timeline.to(benefitCopy, {
          autoAlpha: 0,
          yPercent: copyY,
          duration: .1,
        }, "frame-exit+=.28");

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
  sequenceMedia.addEventListener("change", syncPrecisionLayout);
  tabletSequenceMedia.addEventListener("change", syncPrecisionLayout);
};

initSiteHeader({ hero });
initHeroExpansion();
initRestorationStage();
initPrecisionSequence();
initImplantDigitalSequence({ header });
initCoverflow(document.querySelector("[data-implant-coverflow]"), implantCases);
initFaqSection(document.querySelector("[data-implant-faq]"), {
  label: "FAQ",
  title: "임플란트,\n무엇이 궁금하세요?",
  subtitle: "진료 전에 많이 물어보시는 내용을 먼저 정리했습니다.",
  items: implantFaqs,
});

Promise.all([
  document.fonts?.ready,
  ...[heroImage, precisionImage, precisionRevealImage, precisionProductImage]
    .filter(Boolean)
    .map((image) => image.decode?.().catch(() => {})),
]).then(() => ScrollTrigger.refresh());
