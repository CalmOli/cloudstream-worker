/**
 * Shameless provider
 * Site: https://shameless.com
 */

import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://shameless.com';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/latest-updates/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const parts = html.split('<div class="item card">');
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    try {
      const urlMatch = block.match(/<a[^>]*href\s*=\s*"([^"]*\/videos\/[^"]*)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<a[^>]*class="[^"]*card-info__text[^"]*"[^>]*>([^<]+)/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /data-src="([^"]+)"/) ||
                   extractFirst(block, /data-original="([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const shameless = {
  async mainpage() {
    const results = [];
    for (const section of SECTIONS) {
      const { html, url } = await fetchPage(section.url);
      results.push({ name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) });
    }
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/?q=${encodeURIComponent(query)}`;
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
    const sources = [];
    const seen = new Set();

    // Strategy 1: video_url JS variable (primary for shameless)
    const urlRe = /video_url\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = urlRe.exec(html)) !== null) {
      const u = m[1];
      if (u.startsWith('function/')) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      const quality = u.includes('_hd_') ? 720 : u.includes('_sd_480') ? 480 : u.includes('_sd_240') ? 240 : 0;
      sources.push({ url: u, quality, isM3u8: false });
    }

    // Strategy 2: <source src> tags
    const srcRe = /<source[^>]*src\s*=\s*['"]([^'"]+)['"]/gi;
    while ((m = srcRe.exec(html)) !== null) {
      let u = m[1];
      if (u.startsWith('//')) u = 'https:' + u;
      if (seen.has(u)) continue;
      seen.add(u);
      sources.push({ url: u, quality: 0, isM3u8: false });
    }

    // Strategy 3: og:video meta
    const ogRe = /<meta[^>]*(?:property|name)\s*=\s*['"](?:og:video)['"][^>]*content\s*=\s*['"]([^'"]+)['"]/gi;
    while ((m = ogRe.exec(html)) !== null) {
      let u = m[1];
      if (u.startsWith('//')) u = 'https:' + u;
      if (seen.has(u)) continue;
      seen.add(u);
      sources.push({ url: u, quality: 0, isM3u8: u.includes('.m3u8') });
    }

    return { page: videoUrl, sources };
  },
};
