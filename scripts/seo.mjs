const DEFAULT_SITE_URL = "https://test.42vision.app";

export const SITE_URL = (process.env.SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, "");
export const SEO_IMAGE_PATH = "/assets/images/og-365-seoul-gamdong.png";

export const PAGE_SEO = {
  "index.html": { path: "/", breadcrumbName: "홈" },
  "implant.html": { path: "/implant", breadcrumbName: "임플란트" },
  "general.html": { path: "/general", breadcrumbName: "일반진료" },
  "whitening.html": { path: "/whitening", breadcrumbName: "치아 미백·심미치료" },
  "location.html": { path: "/location", breadcrumbName: "진료시간·오시는 길" },
};

export const PAGE_FILES = Object.keys(PAGE_SEO);

const clinic = {
  name: "365서울감동치과의원",
  telephone: "+82-31-591-7522",
  address: {
    "@type": "PostalAddress",
    addressCountry: "KR",
    addressRegion: "경기도",
    addressLocality: "남양주시",
    streetAddress: "화도읍 마석로 33, 3층 313·314·317~321호",
  },
};

const escapeAttribute = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const extractHeadValue = (source, pattern, label) => {
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing ${label} in page source`);
  return match[1].trim();
};

export const pageMetadata = (filename, source) => {
  const config = PAGE_SEO[filename];
  if (!config) throw new Error(`Unknown SEO page: ${filename}`);
  const title = extractHeadValue(source, /<title>([^<]+)<\/title>/, "title");
  const description = extractHeadValue(
    source,
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']\s*\/?>/,
    "meta description",
  );
  const canonical = `${SITE_URL}${config.path}`;
  return { ...config, title, description, canonical };
};

const breadcrumbItems = (page) => {
  const items = [{ "@type": "ListItem", position: 1, name: "홈", item: `${SITE_URL}/` }];
  if (page.path !== "/") {
    items.push({ "@type": "ListItem", position: 2, name: page.breadcrumbName, item: page.canonical });
  }
  return items;
};

export const structuredData = (page) => {
  const imageUrl = `${SITE_URL}${SEO_IMAGE_PATH}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Dentist", "Organization"],
        "@id": `${SITE_URL}/#dentist`,
        name: clinic.name,
        url: `${SITE_URL}/`,
        image: { "@id": `${SITE_URL}/#primaryimage` },
        telephone: clinic.telephone,
        address: clinic.address,
        medicalSpecialty: "https://schema.org/Dentistry",
        areaServed: { "@type": "City", name: "남양주시" },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: clinic.name,
        inLanguage: "ko-KR",
        publisher: { "@id": `${SITE_URL}/#dentist` },
      },
      {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/#primaryimage`,
        url: imageUrl,
        contentUrl: imageUrl,
        width: 1200,
        height: 630,
      },
      {
        "@type": "WebPage",
        "@id": `${page.canonical}#webpage`,
        url: page.canonical,
        name: page.title,
        description: page.description,
        inLanguage: "ko-KR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#dentist` },
        primaryImageOfPage: { "@id": `${SITE_URL}/#primaryimage` },
        breadcrumb: { "@id": `${page.canonical}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${page.canonical}#breadcrumb`,
        itemListElement: breadcrumbItems(page),
      },
    ],
  };
};

export const renderSeoHead = (filename, source) => {
  const page = pageMetadata(filename, source);
  const imageUrl = `${SITE_URL}${SEO_IMAGE_PATH}`;
  const schema = JSON.stringify(structuredData(page)).replaceAll("<", "\\u003c");

  return [
    `<link rel="canonical" href="${escapeAttribute(page.canonical)}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
    '<meta property="og:locale" content="ko_KR" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeAttribute(clinic.name)}" />`,
    `<meta property="og:title" content="${escapeAttribute(page.title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(page.description)}" />`,
    `<meta property="og:url" content="${escapeAttribute(page.canonical)}" />`,
    `<meta property="og:image" content="${escapeAttribute(imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${escapeAttribute(imageUrl)}" />`,
    '<meta property="og:image:type" content="image/png" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${escapeAttribute(clinic.name)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeAttribute(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(page.description)}" />`,
    `<meta name="twitter:image" content="${escapeAttribute(imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttribute(clinic.name)}" />`,
    `<script type="application/ld+json">${schema}</script>`,
  ].join("\n    ");
};

export const renderRobots = () => [
  "User-agent: *",
  "Allow: /",
  "",
  `Sitemap: ${SITE_URL}/sitemap.xml`,
  "",
].join("\n");

export const renderSitemap = () => {
  const urls = Object.values(PAGE_SEO)
    .map(({ path }) => `  <url><loc>${SITE_URL}${path}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};
