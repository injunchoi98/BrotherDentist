import { initFaqSection } from "./components/faq-section.js";
import { initSiteHeader } from "./components/site-header.js";
import { initKakaoStableViewportHeight } from "./utils/viewport-state.js";

const locationFaqs = [
  {
    question: "주말과 공휴일에도 진료하나요?",
    answer: "네. 주말과 공휴일은 오전 9시 30분부터 오후 6시까지 진료합니다. 임시 휴진이나 명절 일정은 달라질 수 있으므로 방문 전 대표번호로 확인해 주세요.",
  },
  {
    question: "평일 야간에도 진료하나요?",
    answer: "네. 평일은 오후 10시까지 진료합니다. 당일 진료 상황에 따라 접수 가능 시간이 달라질 수 있어 늦은 시간에 방문하실 때는 먼저 전화로 문의해 주세요.",
  },
  {
    question: "예약 없이 방문해도 되나요?",
    answer: "방문은 가능하지만 예약 환자의 진료 상황에 따라 대기 시간이 길어질 수 있습니다. 대표번호로 증상과 원하는 방문 시간을 알려주시면 가능한 일정을 안내합니다.",
  },
  {
    question: "주차할 수 있나요?",
    answer: "건물 내 주차장을 이용할 수 있습니다. 진료 후 데스크에서 주차 등록 방법과 지원 시간을 확인해 주세요.",
  },
  {
    question: "가장 가까운 지하철 출구는 어디인가요?",
    answer: "○○역 3번 출구에서 도보 약 3분 거리입니다. 실제 병원 주소가 확정되면 외부 지도 길찾기 링크와 함께 정확한 동선을 안내합니다.",
  },
];

const initLocationTabs = () => {
  const nav = document.querySelector("[data-location-tabs]");
  const header = document.querySelector("[data-header]");
  const links = [...nav?.querySelectorAll('a[href^="#"]') ?? []];
  const sections = links
    .map((link) => document.querySelector(link.hash))
    .filter(Boolean);
  if (!nav || !links.length || !sections.length) return;

  let syncFrame = 0;

  const setCurrent = (id) => {
    links.forEach((link) => {
      if (link.hash === `#${id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const syncLocationNavigation = () => {
    syncFrame = 0;
    const headerHidden = header?.hasAttribute("data-hidden") ?? false;
    nav.toggleAttribute("data-header-hidden", headerHidden);

    // The global document scroll-padding already reserves the site header.
    // This page only adds the secondary sticky navigation height.
    const stickyOffset = nav.offsetHeight;
    document.documentElement.style.setProperty("--location-sticky-offset", `${stickyOffset}px`);

    const activationLine = nav.getBoundingClientRect().bottom + Math.min(innerHeight * .12, 96);
    let currentSection = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= activationLine) currentSection = section;
      else break;
    }

    const reachedDocumentEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    setCurrent(reachedDocumentEnd ? sections.at(-1).id : currentSection.id);
  };

  const scheduleLocationNavigationSync = () => {
    if (!syncFrame) syncFrame = requestAnimationFrame(syncLocationNavigation);
  };

  links.forEach((link) => {
    link.addEventListener("click", () => {
      setCurrent(link.hash.slice(1));
      scheduleLocationNavigationSync();
    });
  });
  addEventListener("hashchange", () => {
    const target = location.hash.slice(1);
    if (sections.some((section) => section.id === target)) setCurrent(target);
    scheduleLocationNavigationSync();
  });

  const headerObserver = header
    ? new MutationObserver(scheduleLocationNavigationSync)
    : null;
  const sizeObserver = new ResizeObserver(scheduleLocationNavigationSync);
  headerObserver?.observe(header, { attributes: true, attributeFilter: ["data-hidden"] });
  if (header) sizeObserver.observe(header);
  sizeObserver.observe(nav);
  addEventListener("scroll", scheduleLocationNavigationSync, { passive: true });
  addEventListener("resize", scheduleLocationNavigationSync, { passive: true });

  const initialTarget = location.hash.slice(1);
  setCurrent(sections.some((section) => section.id === initialTarget) ? initialTarget : sections[0].id);
  scheduleLocationNavigationSync();
};

initKakaoStableViewportHeight();
initFaqSection(document.querySelector("[data-location-faq]"), {
  label: "FAQ",
  title: "방문 전\n자주 묻는 질문",
  subtitle: "진료시간과 예약, 주차와 대중교통에 관한 질문을 정리했습니다.",
  items: locationFaqs,
});
initSiteHeader();
initLocationTabs();
