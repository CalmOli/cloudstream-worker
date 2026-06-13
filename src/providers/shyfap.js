/**
 * Shyfap provider
 * Site: https://www.shyfap.net
 */

import { fetchPage, extractFirst, resolveVideoUrl } from './helpers.js';
import { extractVideoSources } from './video-sources.js';

const BASE = 'https://www.shyfap.net';

const SECTIONS = [
  { name: 'Latest Videos', url: BASE },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<div\s+class="catalog_item"[\s\S]*?<\/div>\s*<\/div>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/<a[^>]*href\s*=\s*"([^"]+?)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<div[^>]*class="[^"]*media-card_title[^"]*"[^>]*>([^<]+)/) ||
                  extractFirst(block, /<img[^>]*alt\s*=\s*"([^"]+)"/) ||
                  extractFirst(block, /title\s*=\s*"([^"]+)"/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /<img[^>]*data-original="([^"]+)"/) ||
                   extractFirst(block, /src\s*=\s*"([^"]+\.(?:jpg|jpeg|png|webp))"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const shyfap = {
  async mainpage() {
    const results = [];
    for (const section of SECTIONS) {
      const { html, url } = await fetchPage(section.url);
      results.push({ name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) });
    }
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/?q=${encodeURIComponent(query)}&page=${page}`;
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
    const { html } = await fetchPage(videoUrl, { referer: videoUrl });
    const sources = extractVideoSources(html);
    const resolved = await Promise.all(sources.map(async (src) => {
      const result = await resolveVideoUrl(src.url, videoUrl);
      if (result.status > 0 && !result.contentType.includes('text/html')) {
        const quality = parseInt(src.quality) || 0;
        return { url: result.url, quality, isM3u8: result.isM3u8 || false };
      }
      return { url: src.url, quality: parseInt(src.quality) || 0, isM3u8: false };
    }));
    return { sources: resolved.filter(s => s.url) };
  },
};
