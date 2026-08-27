import { reviews } from "../data.js";
import { responsivePicture } from "../utils/responsive-image.js";

export function initReviewMarquee() {
  const track = document.querySelector("[data-review-track]");
  if (!track) return;
  const items = [...reviews, ...reviews];
  track.innerHTML = items.map((review, index) => `
    <article class="review-card" ${index >= reviews.length ? "aria-hidden=\"true\"" : ""}>
      <header class="review-card-header">
        ${responsivePicture({ source: review.avatar, widths: [48, 96], sizes: "3rem", width: 96, height: 96, alt: "", className: "review-avatar" })}
        <span><strong>${review.nickname}</strong><small>${review.counts}</small></span>
      </header>
      <p>${review.message}</p>
    </article>`).join("");
}
