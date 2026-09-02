import { doctors } from "../data.js";
import { responsivePicture, webpSource, webpSrcset } from "../utils/responsive-image.js";

export function initDoctorGallery() {
  const root = document.querySelector("[data-doctors]");
  if (!root) return;
  const image = root.querySelector("[data-doctor-image]");
  const source = root.querySelector("[data-doctor-source]");
  const name = root.querySelector("[data-doctor-name]");
  const role = root.querySelector("[data-doctor-role]");
  const quote = root.querySelector("[data-doctor-quote]");
  const careers = root.querySelector("[data-doctor-careers]");
  const thumbs = root.querySelector("[data-doctor-thumbs]");
  let current = 0;

  thumbs.innerHTML = doctors.map((doctor, index) => `
    <button class="doctor-thumb" type="button" data-doctor-index="${index}" aria-label="${doctor.name} ${doctor.role} 보기">
      ${responsivePicture({ source: doctor.image, widths: [266, 532], sizes: "8rem", width: 532, height: 622, alt: "" })}<span><strong>${doctor.name}</strong><small>${doctor.role}</small></span>
    </button>`).join("");

  const render = (index) => {
    current = (index + doctors.length) % doctors.length;
    const doctor = doctors[current];
    root.classList.add("is-changing");
    window.setTimeout(() => {
      image.src = webpSource(doctor.image, 532);
      if (source) source.srcset = webpSrcset(doctor.image, [266, 532]);
      image.alt = `${doctor.name} ${doctor.role} 프로필 이미지`;
      name.textContent = doctor.name;
      role.textContent = doctor.role;
      quote.textContent = doctor.quote;
      careers.innerHTML = doctor.careers.map((career) => `<li>${career}</li>`).join("");
      [...thumbs.children].forEach((thumb, i) => {
        if (i === current) thumb.setAttribute("aria-current", "true");
        else thumb.removeAttribute("aria-current");
      });
      root.classList.remove("is-changing");
    }, 120);
  };
  thumbs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-doctor-index]");
    if (button) render(Number(button.dataset.doctorIndex));
  });
  root.querySelector("[data-doctor-prev]").addEventListener("click", () => render(current - 1));
  root.querySelector("[data-doctor-next]").addEventListener("click", () => render(current + 1));
  render(0);
}
