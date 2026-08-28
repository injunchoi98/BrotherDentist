import {
  calculatePinMinimumHeightRem,
  createPinHeightGuard
} from "../utils/pin-height-guard.js";
import { bindVisualViewportMetrics } from "../utils/visual-viewport.js";

export function initBrandReveal() {
  const section = document.querySelector("[data-brand-reveal]");
  if (!section) return;
  const mask = section.querySelector("[data-brand-mask]");
  const sticky = section.querySelector(".brand-sticky");
  const title = section.querySelector(".brand-title");
  const maskCopy = section.querySelector(".brand-mask-copy");
  const header = document.querySelector("[data-header]");

  const measureStackHeight = (container) => [...container.children]
    .reduce((height, child) => {
      const styles = getComputedStyle(child);
      return height
        + child.getBoundingClientRect().height
        + (Number.parseFloat(styles.marginTop) || 0)
        + (Number.parseFloat(styles.marginBottom) || 0);
    }, 0);

  const getTextMinimumHeightRem = () => {
    const titleHeight = title.getBoundingClientRect().height;
    const revealCopyHeight = measureStackHeight(maskCopy);

    // Both three-line message groups occupy the same sticky viewport at
    // different progress points. Protect the taller group plus the fixed
    // header; the photograph may crop without disabling the transition.
    return calculatePinMinimumHeightRem({
      headerHeightPixels: header?.getBoundingClientRect().height || 0,
      contentHeightPixels: Math.max(titleHeight, revealCopyHeight),
      topSafetyRem: 2,
      bottomSafetyRem: 2
    });
  };

  const update = () => {
    const rect = section.getBoundingClientRect();
    const distance = Math.max(1, section.offsetHeight - (sticky?.offsetHeight || document.documentElement.clientHeight));
    const scrolled = Math.min(distance, Math.max(0, -rect.top));
    const startDistance = Math.min(distance - 1, (distance * .08) + 100);
    const growth = Math.max(0, (scrolled - startDistance) / Math.max(1, distance - startDistance));
    const eased = growth * growth * (3 - (2 * growth));
    // Keep the layer completely unpainted at the closed end. On iOS Safari,
    // showing the 1rem-wide mask while its progress is effectively zero can
    // preserve a stale composited edge when the user reverses the scroll.
    const visible = eased > .006;
    mask.style.setProperty("--reveal", visible ? eased.toFixed(4) : "0");
    mask.classList.toggle("is-visible", visible);
  };
  const reset = () => {
    mask.style.removeProperty("--reveal");
    mask.classList.remove("is-visible");
  };

  return createPinHeightGuard({
    section,
    allowMobile: true,
    minimumHeightRem: getTextMinimumHeightRem,
    onEnable: () => {
      const unbindVisualViewport = bindVisualViewportMetrics(sticky);
      update();
      addEventListener("scroll", update, { passive: true });
      return () => {
        removeEventListener("scroll", update);
        unbindVisualViewport();
      };
    },
    onDisable: () => {
      removeEventListener("scroll", update);
      reset();
    }
  });
}
