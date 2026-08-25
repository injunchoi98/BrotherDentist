import { doctors } from "../data.js";

export function initDoctorGallery() {
  const root = document.querySelector("[data-doctors]");
  if (!root) return;
  const image = root.querySelector("[data-doctor-image]");
  const name = root.querySelector("[data-doctor-name]");
  const role = root.querySelector("[data-doctor-role]");
  const quote = root.querySelector("[data-doctor-quote]");
  const careers = root.querySelector("[data-doctor-careers]");
  const thumbs = root.querySelector("[data-doctor-thumbs]");

  thumbs.innerHTML = doctors.map((doctor, index) => `
    <button class="doctor-thumb" type="button" data-doctor-index="${index}" aria-label="${doctor.name} ${doctor.role} 보기">
      <img src="${doctor.image}" alt="" /><span><strong>${doctor.name}</strong><small>${doctor.role.split(" · ")[1]}</small></span>
    </button>`).join("");

  const render = (index) => {
    const doctor = doctors[index];
    root.classList.add("is-changing");
    window.setTimeout(() => {
      image.src = doctor.image;
      image.alt = `${doctor.name} ${doctor.role} 프로필 이미지`;
      name.textContent = doctor.name;
      role.textContent = doctor.role;
      quote.textContent = doctor.quote;
      careers.innerHTML = doctor.careers.map((career) => `<li>${career}</li>`).join("");
      [...thumbs.children].forEach((thumb, i) => thumb.toggleAttribute("aria-current", i === index));
      root.classList.remove("is-changing");
    }, 120);
  };
  thumbs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-doctor-index]");
    if (button) render(Number(button.dataset.doctorIndex));
  });
  render(0);
}
