/**
 * Taboodude provider
 * Site: https://www.taboodude.com
 * Videos now listed on homepage, /videos/ returns 404
 */

import { fetchPage, extractFirst, extractSourcesFromPage } from './helpers.js';

const BASE = 'https://www.taboodude.com';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<a[^>]*href\s*=\s*"([^"]*\/video\/[^"]*)"[\s\S]*?<\/a>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      let url = match[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /title\s*=\s*"([^"]+)"/) ||
                  extractFirst(block, /<img[^>]*alt\s*=\s*"([^"]+)"/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /<img[^>]*src\s*=\s*"([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const taboodude = {
  async mainpage() {
    const results = [];
    for (const section of SECTIONS) {
      const { html, url } = await fetchPage(section.url);
      results.push({ name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) });
    }
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search?q=${encodeURIComponent(query)}&page=${page}`;
    const { html } = await fetchPage(searchUrl);
    const items = parseItems(html, searchUrl);
    return { items: items.slice(0, 50), page };
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
    const sources = await extractSourcesFromPage(videoUrl);
    return { page: videoUrl, sources };
  },
};
