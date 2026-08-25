import { reviews } from "../data.js";

export function initReviewMarquee() {
  const track = document.querySelector("[data-review-track]");
  if (!track) return;
  const items = [...reviews, ...reviews];
  track.innerHTML = items.map((review, index) => `
    <article class="review-card" ${index >= reviews.length ? "aria-hidden=\"true\"" : ""}>
      <div class="review-stars" aria-label="별점 5점">★★★★★</div><p>${review}</p><small>방문 환자 목업 리뷰</small>
    </article>`).join("");
}
