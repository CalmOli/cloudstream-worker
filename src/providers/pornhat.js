/**
 * Pornhat provider
 * Site: https://www.pornhat.com
 */

import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://www.pornhat.com';

const SECTIONS = [
  { name: 'Fresh Videos', url: BASE },
  { name: 'Popular', url: `${BASE}/popular/` },
  { name: 'Trending', url: `${BASE}/trending/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<div\s+class="item\s+thumb-bl\s+thumb-bl-video[\s\S]*?<\/div>\s*<\/div>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/<a[^>]*href\s*=\s*"([^"]+?)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /title\s*=\s*"([^"]+)"/i);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /data-original="([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const pornhat = {
  async mainpage() {
    const results = await Promise.all(SECTIONS.map(async (section) => {
      const { html, url } = await fetchPage(section.url);
      return { name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) };
    }));
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/${page}/?q=${encodeURIComponent(query)}`;
    const { html } = await fetchPage(searchUrl);
    return { items: parseItems(html, searchUrl), page };
  },
  async load(videoUrl) {
    const { html } = await fetchPage(videoUrl);
    // Pornhat uses og:title for the video title
    let title = extractFirst(html, /<meta[^>]*property\s*=\s*"og:title"[^>]*content\s*=\s*"([^"]+)"/i) ||
                extractFirst(html, /<title>([^<]+)/);
    if (title) {
      // Filter out RTA/parental control titles
      title = title.trim();
      if (title.includes('RTA') || title.includes('Parental Control')) title = null;
    }
    if (!title) title = extractFirst(html, /<h1[^>]*>([^<]+)/);
    if (title) title = title.trim();

    const poster = extractFirst(html, /<meta[^>]*property\s*=\s*"og:image"[^>]*content\s*=\s*"([^"]+)"/i);
    const description = extractFirst(html, /<meta[^>]*name\s*=\s*"description"[^>]*content\s*=\s*"([^"]+)"/i);

    return { title, poster, description: description || null, tags: [] };
  },
  async loadlinks(videoUrl) {
    return { page: videoUrl, sources: [] };
  },
};
