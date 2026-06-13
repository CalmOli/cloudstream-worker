/**
 * Sexu provider
 * Site: https://sexu.com
 */

import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://sexu.com';

const SECTIONS = [
  { name: 'Latest Videos', url: BASE },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<li\s+class="grid__item"[\s\S]*?<\/li>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/<a[^>]*href\s*=\s*"([^"]+?)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) {
        if (url.startsWith('//')) url = 'https:' + url;
        else url = new URL(url, BASE).href;
      }

      let title = extractFirst(block, /<a[^>]*title\s*=\s*"([^"]+)"/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /<img[^>]*src\s*=\s*"([^"]+)"/);
      if (poster && poster.startsWith('//')) poster = 'https:' + poster;

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const sexu = {
  async mainpage() {
    const results = [];
    for (const section of SECTIONS) {
      const { html, url } = await fetchPage(section.url);
      results.push({ name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) });
    }
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/${encodeURIComponent(query)}/page/${page}/`;
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
    return { page: videoUrl, sources: [] };
  },
};
