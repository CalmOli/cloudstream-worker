/**
 * Analdin provider
 * Site: https://www.analdin.com
 */

import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://www.analdin.com';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/latest-updates/` },
  { name: 'Most Viewed', url: `${BASE}/most-popular/` },
  { name: 'Top Rated', url: `${BASE}/top-rated/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  // Match full <a class="popup-video-link"...>...</a> blocks
  const itemRe = /<a\s+class="popup-video-link"[\s\S]*?<\/a>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/href\s*=\s*"([^"]+)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<strong[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /data-original="([^"]+)"/) ||
                   extractFirst(block, /\bthumb\s*=\s*"([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const analdin = {
  async mainpage() {
    const results = await Promise.all(SECTIONS.map(async (section) => {
      const { html, url } = await fetchPage(section.url);
      return { name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) };
    }));
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/${encodeURIComponent(query)}/`;
    const { html, url } = await fetchPage(searchUrl);
    return { items: parseItems(html, url), page };
  },
  async load(videoUrl) {
    const { html } = await fetchPage(videoUrl);
    let title = extractFirst(html, /<h1[^>]*>([^<]+)/) ||
                extractFirst(html, /<meta[^>]*property\s*=\s*"og:title"[^>]*content\s*=\s*"([^"]+)"/i) ||
                extractFirst(html, /<title>([^<]+)/);
    if (title) title = title.trim();

    let poster = extractFirst(html, /<meta[^>]*property\s*=\s*"og:image"[^>]*content\s*=\s*"([^"]+)"/i);
    if (!poster) {
      const idMatch = videoUrl.match(/\/videos\/(\d+)/);
      if (idMatch) {
        const id = parseInt(idMatch[1], 10);
        const base = Math.floor(id / 1000) * 1000;
        poster = `https://i.analdin.com/contents/videos_screenshots/${base}/${id}/293x165/1.jpg`;
      }
    }

    const description = extractFirst(html, /<meta[^>]*name\s*=\s*"description"[^>]*content\s*=\s*"([^"]+)"/i);
    return { title, poster, description: description || null, tags: [] };
  },
  async loadlinks(videoUrl) {
    return { page: videoUrl, sources: [] };
  },
};
