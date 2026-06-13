/**
 * Spankbang provider
 * Site: https://spankbang.com
 * Uses the main page directly since trending_videos/ gets 403
 */

import { fetchPage, extractFirst } from './helpers.js';
import { extractVideoSources } from './video-sources.js';

const BASE = 'https://spankbang.com';

const SECTIONS = [
  { name: 'New Videos', url: BASE },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<div\s+class="js-video-item"[\s\S]*?<\/div>\s*<\/div>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/<a[^>]*href\s*=\s*"([^"]*\/video\/[^"]*)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<img[^>]*alt\s*=\s*"([^"]+)"/i);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /<img[^>]*src\s*=\s*"([^"]+)"[^>]*>/i);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const spankbang = {
  async mainpage() {
    const results = [];
    for (const section of SECTIONS) {
      const { html, url } = await fetchPage(section.url).catch(() => ({ html: '' }));
      if (!html) continue;
      const items = parseItems(html, url);
      if (items.length > 0) results.push({ name: section.name, url: section.url, items: items.slice(0, 50) });
    }
    return { sections: results.length ? results : [{ name: 'No Results', url: BASE, items: [] }] };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/s/${encodeURIComponent(query)}/${page}/?o=all`;
    const { html } = await fetchPage(searchUrl).catch(() => ({ html: '' }));
    return { items: parseItems(html, searchUrl), page };
  },
  async load(videoUrl) {
    const { html } = await fetchPage(videoUrl);
    let title = extractFirst(html, /<meta[^>]*property\s*=\s*"og:title"[^>]*content\s*=\s*"([^"]+)"/i) ||
                extractFirst(html, /<title>([^<]+)/);
    if (title) title = title.trim();
    const poster = extractFirst(html, /<meta[^>]*property\s*=\s*"og:image"[^>]*content\s*=\s*"([^"]+)"/i);
    const description = extractFirst(html, /<meta[^>]*name\s*=\s*"description"[^>]*content\s*=\s*"([^"]+)"/i);
    return { title, poster, description: description || null, tags: [] };
  },
  async loadlinks(videoUrl) {
    const { html } = await fetchPage(videoUrl, { referer: videoUrl });
    const sources = [];
    const srcRe = /<source[^>]*src="([^"]+)"[^>]*>/gi;
    let match;
    while ((match = srcRe.exec(html)) !== null) {
      sources.push({ url: match[1], quality: 'unknown' });
    }
    return { sources: sources.length ? sources : extractVideoSources(html) };
  },
};
