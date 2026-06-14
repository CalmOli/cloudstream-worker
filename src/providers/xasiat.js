import { fetchPage, extractFirst, extractSourcesFromPage } from './helpers.js';

const BASE = 'https://www.xasiat.com';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/latest-updates/` },
  { name: 'Top Rated', url: `${BASE}/top-rated/` },
  { name: 'Most Viewed', url: `${BASE}/most-popular/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<a[^>]*href="[^"]*\/videos\/[^"]*"[\s\S]*?<\/a>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/href\s*=\s*"([^"]+?)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      const titleMatch = block.match(/<strong[^>]*class="title"[^>]*>([^<]+)/);
      let title;
      if (!titleMatch) {
        const strongMatch = block.match(/<strong[^>]*>([^<]+)/);
        title = strongMatch ? strongMatch[1] : null;
      } else {
        title = titleMatch[1];
      }
      if (!title) continue;
      title = title.trim();

      let poster = null;
      const posterMatch = block.match(/<img[^>]*class="[^"]*thumb[^"]*lazy-load[^"]*"[^>]*data-original\s*=\s*"([^"]+)"/);
      if (posterMatch) {
        poster = posterMatch[1];
      } else {
        const srcMatch = block.match(/<img[^>]*src\s*=\s*"([^"]+)"/);
        if (srcMatch) poster = srcMatch[1];
      }
      if (poster && !poster.startsWith('http')) poster = new URL(poster, BASE).href;

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const xasiat = {
  async mainpage() {
    const results = await Promise.all(SECTIONS.map(async (section) => {
      const { html, url } = await fetchPage(section.url);
      return { name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) };
    }));
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/${query}/`;
    const { html } = await fetchPage(searchUrl);
    return { items: parseItems(html, searchUrl), page };
  },
  async load(videoUrl) {
    const { html } = await fetchPage(videoUrl);
    let title = extractFirst(html, /<h1[^>]*>([^<]+)/) ||
                extractFirst(html, /<meta[^>]*property\s*=\s*"og:title"[^>]*content\s*=\s*"([^"]+)"/i) ||
                extractFirst(html, /<title>([^<]+)/);
    if (title) title = title.trim();
    const poster = extractFirst(html, /<meta[^>]*property\s*=\s*"og:image"[^>]*content\s*=\s*"([^"]+)"/i);
    const description = extractFirst(html, /<meta[^>]*name\s*=\s*"description"[^>]*content\s*=\s*"([^"]+)"/i);
    return { title, poster, description: description || null, tags: [] };
  },
  async loadlinks(videoUrl) {
    const { html } = await fetchPage(videoUrl);
    const embedUrl = extractFirst(html, /<meta[^>]*property\s*=\s*"og:video(?::url|:secure_url)?"[^>]*content\s*=\s*"([^"]+)"/i) ||
                     extractFirst(html, /<meta[^>]*content\s*=\s*"([^"]+)"[^>]*property\s*=\s*"og:video(?:url|:secure_url)?"/i);
    if (embedUrl && !embedUrl.match(/\.(mp4|m3u8)/)) {
      const sources = await extractSourcesFromPage(embedUrl, { resolveRedirects: true });
      if (sources && sources.length > 0) return { page: videoUrl, sources, html };
    }
    return { page: videoUrl, sources: [], html };
  },
};
