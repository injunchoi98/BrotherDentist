import { ArrowDown, ArrowUpRight, CalendarTick, ChatRoundDots, Location } from "reicon";
import { initCoverflow } from "./components/coverflow.js";
import { initFaqSection } from "./components/faq-section.js";
import { initSiteHeader } from "./components/site-header.js";

const generalCases = [
  {
    category: "충치 · 레진",
    title: "작게 시작된 충치를 자연스럽게",
    copy: "충치가 퍼진 범위를 확인한 뒤 필요한 부분만 제거하고 주변 치아의 색과 형태에 맞춰 회복합니다.",
    image: "./assets/images/case-general-resin-v2.png",
    beforeAlt: "충치와 레진 치료 전 화면 구성 예시",
    afterAlt: "충치와 레진 치료 후 화면 구성 예시",
  },
  {
    category: "신경치료",
    title: "욱신거리던 치아의 원인부터",
    copy: "신경의 염증 범위와 치아 뿌리의 상태를 확인하고 자연치아를 유지할 수 있도록 치료 순서를 정합니다.",
    image: "./assets/images/case-general-root-canal-v2.png",
    beforeAlt: "신경치료 전 화면 구성 예시",
    afterAlt: "신경치료 후 화면 구성 예시",
  },
  {
    category: "크라운",
    title: "씹는 힘과 치아의 모양을 함께",
    copy: "남은 치아의 높이와 맞물림을 살펴 씹을 때 힘이 한곳에 쏠리지 않도록 보철의 형태를 설계합니다.",
    image: "./assets/images/case-general-crown-v2.png",
    beforeAlt: "크라운 치료 전 화면 구성 예시",
    afterAlt: "크라운 치료 후 화면 구성 예시",
  },
  {
    category: "잇몸치료",
    title: "붓고 피 나던 잇몸을 편안하게",
    copy: "치석과 염증이 머문 위치, 잇몸뼈 상태를 확인해 필요한 부위부터 단계적으로 관리합니다.",
    image: "./assets/images/case-general-periodontal-v2.png",
    beforeAlt: "잇몸치료 전 화면 구성 예시",
    afterAlt: "잇몸치료 후 화면 구성 예시",
  },
  {
    category: "교합 · 턱관절",
    title: "씹을 때의 불편함까지 확인합니다",
    copy: "치아가 닿는 순서와 턱의 움직임, 생활 습관을 함께 살펴 반복되는 불편감의 원인을 찾습니다.",
    image: "./assets/images/case-general-occlusion-v2.png",
    beforeAlt: "교합과 턱관절 진료 전 화면 구성 예시",
    afterAlt: "교합과 턱관절 진료 후 화면 구성 예시",
  },
];

const generalFaqs = [
  {
    question: "일반진료센터에서는 어떤 진료를 받을 수 있나요?",
    answer: "365서울감동치과 일반진료센터에서는 치아미백, 충치치료, 심미치료, 신경치료, 스케일링, 지각과민처치, 불소도포, 실란트, 보톡스, 턱관절 물리치료, 이갈이 장치, 틀니 제작 등을 상담할 수 있습니다.",
  },
  {
    question: "일반진료센터에도 전문의가 있나요?",
    answer: "네. 365서울감동치과 일반진료센터는 분야별 의료진이 함께 환자의 구강 상태를 확인하고 필요한 치료 방향을 안내합니다.",
  },
  {
    question: "치아가 시린 경우 어떤 진료를 받아야 하나요?",
    answer: "치아 시림은 지각과민, 충치, 치아 마모, 잇몸 내려앉음 등 원인이 다양합니다. 치아와 잇몸 상태를 함께 확인해 원인에 맞는 치료 방향을 정하는 것이 좋습니다.",
  },
  {
    question: "스케일링은 정기적으로 받아야 하나요?",
    answer: "네. 치석과 치태는 양치만으로 완전히 제거하기 어려울 수 있어 정기적인 스케일링과 검진이 필요합니다. 잇몸 상태에 따라 관리 주기는 달라질 수 있습니다.",
  },
  {
    question: "충치치료는 레진, 인레이, 크라운 중 어떻게 결정하나요?",
    answer: "충치의 깊이와 범위, 치아 위치, 씹는 힘, 남아 있는 치아 구조를 확인한 뒤 결정합니다. 작은 충치는 레진으로 치료할 수 있고, 범위가 넓으면 인레이나 크라운이 필요할 수 있습니다.",
  },
];

const initActionIcons = () => {
  const icons = {
    booking: CalendarTick,
    consult: ChatRoundDots,
    visit: Location,
  };

  document.querySelectorAll("[data-action-icon]").forEach((slot) => {
    const create = icons[slot.dataset.actionIcon];
    const icon = create?.({ size: 28, strokeWidth: 1.6, attrs: { "aria-hidden": "true" } });
    if (icon) slot.append(icon);
  });

  document.querySelectorAll("[data-action-arrow]").forEach((slot) => {
    const create = slot.dataset.actionArrow === "down" ? ArrowDown : ArrowUpRight;
    const icon = create({ size: 22, strokeWidth: 1.7, attrs: { "aria-hidden": "true" } });
    slot.append(icon);
  });
};

initActionIcons();
initCoverflow(document.querySelector("[data-general-coverflow]"), generalCases);
initFaqSection(document.querySelector("[data-general-faq]"), {
  label: "FAQ",
  title: "일반진료,\n무엇이 궁금하세요?",
  subtitle: "진료 전에 많이 물어보시는 내용을 먼저 정리했습니다.",
  items: generalFaqs,
});
initSiteHeader({ hero: document.querySelector(".hyuk-hero") });
