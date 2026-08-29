const HEADER_DIRECTION_THRESHOLD = 6;
const HEADER_TOP_THRESHOLD = 8;
const HEADER_SURFACE_OFFSET = 96;

export function initSiteHeader({ hero } = {}) {
  const header = document.querySelector("[data-header]");
  if (!header) return () => {};

  const menuButton = header.querySelector("[data-menu]");
  const nav = header.querySelector("[data-nav]");
  const treatmentMenu = nav?.querySelector("[data-treatment-menu]");
  const treatmentToggle = nav?.querySelector("[data-treatment-toggle]");
  const treatmentSubmenu = nav?.querySelector("[data-treatment-submenu]");
  const pageMain = document.querySelector("main");
  const pageFooter = document.querySelector("footer");
  const skipLink = document.querySelector(".skip-link");
  const desktopNavigationInput = matchMedia("(min-width: 64.0625rem)");
  let lastHeaderScrollY = Math.max(0, scrollY);

  const revealHeader = () => {
    header.removeAttribute("data-hidden");
    lastHeaderScrollY = Math.max(0, scrollY);
  };

  const setTreatmentMenuOpen = (open) => {
    if (!treatmentMenu || !treatmentToggle || !treatmentSubmenu) return;
    treatmentMenu.toggleAttribute("data-open", open);
    header.toggleAttribute("data-treatment-open", open);
    treatmentToggle.setAttribute("aria-expanded", String(open));
    treatmentSubmenu.toggleAttribute("inert", !open);

    // An open disclosure must never remain translated above the viewport.
    if (open) revealHeader();
  };

  const setMenuOpen = (open, restoreFocus = true, focusFirstItem = false) => {
    if (!menuButton || !nav) return;
    const wasOpen = nav.hasAttribute("data-open");
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    nav.toggleAttribute("data-open", open);
    header.toggleAttribute("data-menu-open", open);
    document.body.classList.toggle("menu-open", open);
    if (!open) setTreatmentMenuOpen(false);
    if (pageMain) pageMain.inert = open;
    if (pageFooter) pageFooter.inert = open;
    if (skipLink) skipLink.inert = open;

    // Keep the entire navigation and its current focus visible while the
    // off-canvas menu is open, regardless of the previous scroll direction.
    if (open) revealHeader();
    if (open && focusFirstItem) requestAnimationFrame(() => nav.querySelector("a")?.focus());
    else if (!open && restoreFocus && wasOpen) menuButton.focus();
  };

  const headerHasKeyboardFocus = () => (
    header.contains(document.activeElement)
    && document.activeElement?.matches?.(":focus-visible")
  );

  const updateHeader = () => {
    const currentScrollY = Math.max(0, scrollY);
    const lightSurfaceStart = (hero?.offsetHeight || innerHeight) - HEADER_SURFACE_OFFSET;
    header.toggleAttribute("data-on-light", currentScrollY > lightSurfaceStart);

    const interactionOpen = nav?.hasAttribute("data-open")
      || treatmentMenu?.hasAttribute("data-open")
      || headerHasKeyboardFocus();

    // Always expose the header at the top and during keyboard/menu use. This
    // is both a usability rule and a focus-visibility accessibility guard.
    if (currentScrollY <= HEADER_TOP_THRESHOLD || interactionOpen) {
      revealHeader();
      return;
    }

    const scrollDelta = currentScrollY - lastHeaderScrollY;
    // Ignore tiny deltas from touch noise, elastic scrolling, and GSAP snap so
    // the header does not flicker when the document is effectively stationary.
    if (scrollDelta >= HEADER_DIRECTION_THRESHOLD) {
      header.setAttribute("data-hidden", "");
      lastHeaderScrollY = currentScrollY;
    } else if (scrollDelta <= -HEADER_DIRECTION_THRESHOLD) {
      revealHeader();
    }
  };

  const handleMenuClick = (event) => {
    setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true", true, event.detail === 0);
  };
  const handleTreatmentClick = () => {
    setTreatmentMenuOpen(treatmentToggle.getAttribute("aria-expanded") !== "true");
  };
  const handleNavigationClick = (event) => {
    if (!event.target.closest("a")) return;
    setTreatmentMenuOpen(false);
    if (nav.hasAttribute("data-open")) setMenuOpen(false, false);
  };
  const handleWordmarkClick = () => {
    if (nav?.hasAttribute("data-open")) setMenuOpen(false, false);
  };
  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      if (treatmentMenu?.hasAttribute("data-open")) {
        setTreatmentMenuOpen(false);
        treatmentToggle?.focus();
        return;
      }
      if (nav?.hasAttribute("data-open")) setMenuOpen(false);
      return;
    }
    if (!nav?.hasAttribute("data-open") || event.key !== "Tab") return;

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
  };
  const handleTreatmentFocusout = () => {
    requestAnimationFrame(() => {
      if (!treatmentMenu?.contains(document.activeElement)) setTreatmentMenuOpen(false);
    });
  };
  const handleDocumentPointerdown = (event) => {
    if (treatmentMenu?.hasAttribute("data-open") && !event.target.closest("[data-treatment-menu]")) {
      setTreatmentMenuOpen(false);
    }
  };
  const handleDesktopNavigationChange = () => {
    setTreatmentMenuOpen(false);
    if (nav?.hasAttribute("data-open")) setMenuOpen(false, false);
  };
  const handleHeaderFocusin = () => {
    // focusin is not accompanied by a scroll event, so reveal immediately
    // instead of waiting for updateHeader() to notice the focused control.
    revealHeader();
  };

  setTreatmentMenuOpen(false);
  updateHeader();
  addEventListener("scroll", updateHeader, { passive: true });
  addEventListener("keydown", handleKeydown);
  menuButton?.addEventListener("click", handleMenuClick);
  treatmentToggle?.addEventListener("click", handleTreatmentClick);
  nav?.addEventListener("click", handleNavigationClick);
  header.querySelector(".wordmark")?.addEventListener("click", handleWordmarkClick);
  header.addEventListener("focusin", handleHeaderFocusin);
  treatmentMenu?.addEventListener("focusout", handleTreatmentFocusout);
  document.addEventListener("pointerdown", handleDocumentPointerdown);
  desktopNavigationInput.addEventListener("change", handleDesktopNavigationChange);

  return () => {
    removeEventListener("scroll", updateHeader);
    removeEventListener("keydown", handleKeydown);
    menuButton?.removeEventListener("click", handleMenuClick);
    treatmentToggle?.removeEventListener("click", handleTreatmentClick);
    nav?.removeEventListener("click", handleNavigationClick);
    header.querySelector(".wordmark")?.removeEventListener("click", handleWordmarkClick);
    header.removeEventListener("focusin", handleHeaderFocusin);
    treatmentMenu?.removeEventListener("focusout", handleTreatmentFocusout);
    document.removeEventListener("pointerdown", handleDocumentPointerdown);
    desktopNavigationInput.removeEventListener("change", handleDesktopNavigationChange);
  };
}
