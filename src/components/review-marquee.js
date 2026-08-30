import { reviews } from "../data.js";
import { initInfiniteMarquee } from "../utils/infinite-marquee.js";
import { responsivePicture } from "../utils/responsive-image.js";

export function initReviewMarquee() {
  const track = document.querySelector("[data-review-track]");
  if (!track) return;
  track.innerHTML = reviews.map((review) => `
    <article class="review-card">
      <header class="review-card-header">
        ${responsivePicture({ source: review.avatar, widths: [48, 96], sizes: "3rem", width: 96, height: 96, alt: "", className: "review-avatar" })}
        <span><strong>${review.nickname}</strong><small>${review.counts}</small></span>
      </header>
      <p>${review.message}</p>
    </article>`).join("");

  // Match the supplied demo: move right at the slow preset and pause for a
  // fine-pointer reader who wants time to finish a specific review.
  initInfiniteMarquee({ track, direction: "right", speed: "slow" });
}
