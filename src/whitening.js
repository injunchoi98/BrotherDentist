import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { initAnimatedScrollGallery } from "./components/animated-scroll-gallery.js";
import { initCoverflow } from "./components/coverflow.js";
import { initEvidenceScroll } from "./components/evidence-scroll.js";
import { initFaqSection } from "./components/faq-section.js";
import { initSiteHeader } from "./components/site-header.js";
import { initKakaoStableViewportHeight } from "./utils/viewport-state.js";

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const whiteningCases = [
  {
    category: "라미네이트",
    title: "앞니의 색과 형태를 한 흐름으로",
    copy: "치아의 배열과 두께, 잇몸선을 확인한 뒤 자연치아를 보존할 수 있는 범위에서 색과 형태를 조화롭게 다듬습니다.",
    image: "./assets/images/case-whitening-veneer-v1.png",
    beforeAlt: "라미네이트 치료 전 연출 이미지",
    afterAlt: "라미네이트 치료 후 연출 이미지",
  },
  {
    category: "치아 미백",
    title: "얼굴에 어울리는 밝기를 찾습니다",
    copy: "현재 치아색과 착색 원인을 확인하고 피부톤과 기존 보철물에 어울리는 밝기를 정해 단계적으로 미백합니다.",
    image: "./assets/images/case-whitening-professional-v1.png",
    beforeAlt: "치아 미백 전 연출 이미지",
    afterAlt: "치아 미백 후 연출 이미지",
  },
  {
    category: "레진 치료",
    title: "벌어지거나 깨진 앞니를 자연스럽게",
    copy: "치아 사이의 틈이나 작은 파절 부위를 주변 치아의 색과 형태에 맞는 레진으로 회복합니다.",
    image: "./assets/images/case-whitening-resin-v1.png",
    beforeAlt: "앞니 레진 치료 전 연출 이미지",
    afterAlt: "앞니 레진 치료 후 연출 이미지",
  },
  {
    category: "앞니 형태 개선",
    title: "닳고 고르지 않은 치아 끝을 섬세하게",
    copy: "마모된 범위와 맞물림을 확인하고 치아색 레진으로 자연스러운 앞니 윤곽과 길이를 회복합니다.",
    image: "./assets/images/case-whitening-edge-contour-v1.png",
    beforeAlt: "앞니 형태 개선 전 연출 이미지",
    afterAlt: "앞니 형태 개선 후 연출 이미지",
  },
  {
    category: "변색 치아 개선",
    title: "한 치아만 어두워 보여도 자연스럽게",
    copy: "변색의 원인과 주변 치아색을 확인하고 전체 미소에서 이질감이 줄어들도록 자연스러운 밝기를 맞춥니다.",
    image: "./assets/images/case-whitening-discoloration-v1.png",
    beforeAlt: "변색 치아 개선 전 연출 이미지",
    afterAlt: "변색 치아 개선 후 연출 이미지",
  },
];

const whiteningFaqs = [
  {
    question: "심미치료를 하면 치아가 약해지지 않나요?",
    answer: "치료 방법과 치아를 다듬는 범위에 따라 다릅니다. 치아 미백은 치아를 삭제하지 않지만, 라미네이트는 필요한 경우 법랑질 일부를 다듬을 수 있습니다. 치료 전 치아 두께와 충치, 잇몸, 교합을 확인하고 자연치아 삭제를 최소화하는 계획이 중요합니다.",
  },
  {
    question: "치아미백 효과는 얼마나 유지되나요?",
    answer: "유지 기간은 식습관과 흡연, 구강 위생, 원래의 착색 원인에 따라 달라집니다. 커피, 차, 와인처럼 착색이 쉬운 음식과 흡연을 줄이고 정기적으로 관리하면 밝기를 더 오래 유지할 수 있으며, 상태에 따라 추가 미백을 상담할 수 있습니다.",
  },
  {
    question: "라미네이트가 깨지거나 빠질 수 있나요?",
    answer: "네. 강한 충격이나 이갈이와 이 악물기, 단단한 물체를 앞니로 깨무는 습관이 있으면 라미네이트가 깨지거나 접착이 느슨해질 수 있습니다. 움직임이나 교합 불편이 느껴지면 직접 손대지 말고 치과에서 재접착, 수리 또는 교체 가능 여부를 확인해야 합니다.",
  },
  {
    question: "라미네이트 치료 후 음식 섭취는 어떻게 해야하나요?",
    answer: "마취가 남아 있다면 감각이 돌아온 뒤 식사하고, 초기에는 너무 단단하거나 질긴 음식과 앞니로 뜯는 습관을 피하는 것이 좋습니다. 이후에도 얼음이나 견과 껍질처럼 단단한 것을 깨무는 행동은 피하고 양치와 치실로 보철물 경계 부위를 관리합니다.",
  },
  {
    question: "라미네이트 치료 후 이가 시릴 수 있나요?",
    answer: "치아를 다듬거나 접착한 뒤에는 찬 음식에 일시적으로 시릴 수 있습니다. 대개 적응하면서 줄지만 통증이 심하거나 오래 지속되거나, 씹을 때 불편하면 교합과 치아 상태를 확인하기 위해 내원해야 합니다.",
  },
];

initKakaoStableViewportHeight();
initAnimatedScrollGallery(document.querySelector(".aesthetic-hero"));
initEvidenceScroll();
initCoverflow(document.querySelector("[data-whitening-coverflow]"), whiteningCases);
initFaqSection(document.querySelector("[data-whitening-faq]"), {
  label: "FAQ",
  title: "심미치료,\n무엇이 궁금하세요?",
  subtitle: "치아 미백과 라미네이트 진료 전에 많이 물어보시는 내용을 정리했습니다.",
  items: whiteningFaqs,
});
initSiteHeader();
