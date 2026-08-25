export function initImageCompare(root = document) {
  root.querySelectorAll("[data-compare]").forEach((compare) => {
    const range = compare.querySelector("input[type='range']");
    const update = () => compare.style.setProperty("--compare", `${range.value}%`);
    range.addEventListener("input", update);
    update();
  });
}
