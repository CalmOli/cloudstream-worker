import { fetchPage, extractFirst, extractVideoSources } from './helpers.js';

const BASE = 'https://www.hdporn.gg';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/latest-updates/` },
  { name: 'Top Rated', url: `${BASE}/top-rated/` },
  { name: 'Most Viewed', url: `${BASE}/most-popular/` },
];

function parseItems(html, baseUrl) {
  const seen = new Set();
  const items = [];
  const parts = html.split(/<div\s+class="item[^"]*"/g);
  for (let i = 1; i < parts.length && items.length < 50; i++) {
    const block = parts[i];
    try {
      const urlMatch = block.match(/<a[^>]*href="([^"]*\/videos\/[^"]*)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      const key = url.replace(/\/$/, '');
      if (seen.has(key)) continue;
      seen.add(key);

      let title = extractFirst(block, /<strong[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/) ||
                  extractFirst(block, /<a[^>]*title="([^"]+)"/) ||
                  extractFirst(block, /<img[^>]*alt="([^"]+)"/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /data-src="([^"]+)"/) ||
                   extractFirst(block, /data-original="([^"]+)"/) ||
                   extractFirst(block, /src="([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const hdporn = {
  async mainpage() {
    const results = await Promise.all(SECTIONS.map(async (section) => {
      const { html, url } = await fetchPage(section.url);
      return { name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) };
    }));
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/page/${page}/?q=${encodeURIComponent(query)}`;
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
    const { html, cookies } = await fetchPage(videoUrl);
    const sources = extractVideoSources(html, videoUrl);
    return { page: videoUrl, sources, cookies, html };
  },
};
