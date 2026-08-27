import { reviews } from "../data.js";

export function initReviewMarquee() {
  const track = document.querySelector("[data-review-track]");
  if (!track) return;
  const items = [...reviews, ...reviews];
  track.innerHTML = items.map((review, index) => `
    <article class="review-card" ${index >= reviews.length ? "aria-hidden=\"true\"" : ""}>
      <header class="review-card-header">
        <img class="review-avatar" src="${review.avatar}" alt="" />
        <span><strong>${review.nickname}</strong><small>${review.counts}</small></span>
      </header>
      <p>${review.message}</p>
    </article>`).join("");
}
