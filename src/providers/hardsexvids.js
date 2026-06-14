/**
 * Hardsexvids provider
 * Site: https://hardsexvids.com
 */

import { fetchPage, extractFirst, extractSourcesFromPage } from './helpers.js';

const BASE = 'https://hardsexvids.com';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/latest-updates/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const parts = html.split(/<div\s+class="item[^"]*"/g);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    try {
      const urlMatch = block.match(/<a[^>]*href="([^"]*\/videos\/[^"]*)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<strong[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/) ||
                  extractFirst(block, /<a[^>]*title="([^"]+)"/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /data-original="([^"]+)"/) ||
                   extractFirst(block, /src="([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const hardsexvids = {
  async mainpage() {
    const { html, url } = await fetchPage(SECTIONS[0].url);
    return { sections: [{ name: SECTIONS[0].name, url: SECTIONS[0].url, items: parseItems(html, url).slice(0, 50) }] };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/${encodeURIComponent(query)}/`;
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
    const sources = await extractSourcesFromPage(videoUrl, { html });
    return { page: videoUrl, sources, html };
  },
};
