/**
 * Fullvideos provider
 * Site: https://www.fullvideos.xxx
 */

import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://www.fullvideos.xxx';

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
      if (url && !url.startsWith('http')) url = new URL(url, baseUrl).href;

      const key = url.replace(/\/$/, '');
      if (seen.has(key)) continue;
      seen.add(key);

      let title = extractFirst(block, /<a[^>]*title="([^"]+)"/) ||
                  extractFirst(block, /<strong[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /data-src="([^"]+)"/) ||
                   extractFirst(block, /src="([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const fullvideos = {
  async mainpage() {
    const results = await Promise.all(SECTIONS.map(async (section) => {
      const { html, url } = await fetchPage(section.url);
      const items = parseItems(html, url);
      return { name: section.name, url: section.url, items: items.slice(0, 50) };
    }));
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/page/${page}/?q=${encodeURIComponent(query)}`;
    const { html, url } = await fetchPage(searchUrl);
    return { items: parseItems(html, url), page };
  },
  async load(videoUrl) {
    const { html } = await fetchPage(videoUrl);
    let title = extractFirst(html, /<h1[^>]*>([^<]+)/) ||
                extractFirst(html, /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                extractFirst(html, /<title>([^<]+)/);
    if (title) title = title.trim();
    const poster = extractFirst(html, /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const description = extractFirst(html, /<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    return { title, poster, description, tags: [] };
  },
  async loadlinks(videoUrl) {
    return { page: videoUrl, sources: [] };
  },
};
