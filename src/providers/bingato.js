/**
 * Bingato provider
 * Site: https://bingato.com
 */

import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://bingato.com';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/` },
  { name: 'Most Viewed', url: `${BASE}/?sort_by=most%20viewed` },
  { name: 'Longest', url: `${BASE}/?sort_by=longest` },
  { name: 'Quality', url: `${BASE}/?sort_by=quality` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const parts = html.split(/<div\s+class="item[^"]*"/g);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    try {
      const urlMatch = block.match(/<a[^>]*href="([^"]*\/item\/[^"]*)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<strong[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/) ||
                  extractFirst(block, /<a[^>]*title="([^"]+)"/) ||
                  extractFirst(block, /<img[^>]*alt="([^"]+)"/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /data-original="([^"]+)"/) ||
                   extractFirst(block, /<img[^>]*src="([^"]+)"[^>]*>/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const bingato = {
  async mainpage() {
    const results = await Promise.all(SECTIONS.map(async (section) => {
      const { html, url } = await fetchPage(section.url);
      return { name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) };
    }));
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/s?q=${encodeURIComponent(query)}&page=${page}`;
    const { html, url } = await fetchPage(searchUrl);
    return { items: parseItems(html, url), page };
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
