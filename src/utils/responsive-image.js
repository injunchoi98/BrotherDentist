const escapeAttribute = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const imageStem = (source) => source.split("/").at(-1).replace(/\.[^.]+$/, "");

export const webpSource = (source, width) => `./assets/images/webp/${imageStem(source)}-${width}.webp`;

export const webpSrcset = (source, widths) => widths
  .map((width) => `${webpSource(source, width)} ${width}w`)
  .join(", ");

export const responsivePicture = ({
  source,
  widths,
  sizes,
  width,
  height,
  alt = "",
  className = "",
  imageAttributes = "",
}) => `<picture>
  <source type="image/webp" srcset="${webpSrcset(source, widths)}" sizes="${escapeAttribute(sizes)}" />
  <img${className ? ` class="${escapeAttribute(className)}"` : ""} src="${escapeAttribute(webpSource(source, widths.at(-1)))}" alt="${escapeAttribute(alt)}" width="${width}" height="${height}" loading="lazy" decoding="async"${imageAttributes ? ` ${imageAttributes}` : ""} />
</picture>`;
