/**
 * Yespornvip provider
 * Site: https://yesporn.vip
 */

import { fetchPage, extractFirst, extractSourcesFromPage } from './helpers.js';

const BASE = 'https://yesporn.vip';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/latest-updates/` },
  { name: 'Top Rated', url: `${BASE}/top-rated/` },
  { name: 'Most Viewed', url: `${BASE}/most-popular/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<div\s+class="thumb[^"]*item[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/<a[^>]*href\s*=\s*"([^"]*\/video\/[^"]*)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<a[^>]*title\s*=\s*"([^"]+)"/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /data-original="([^"]+)"/) ||
                   extractFirst(block, /data-src="([^"]+)"/) ||
                   extractFirst(block, /src="([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const yespornvip = {
  async mainpage() {
    const results = await Promise.all(SECTIONS.map(async (section) => {
      const { html, url } = await fetchPage(section.url);
      return { name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) };
    }));
    return { sections: results };
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
