import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://blowjobs.pro';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/latest-updates/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<a[^>]*href="[^"]*\/videos\/[^"]*"[\s\S]*?<\/a>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/href\s*=\s*"([^"]+?)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      const titleMatch = block.match(/<strong[^>]*class="title"[^>]*>([^<]+)/);
      let title;
      if (!titleMatch) {
        const strongMatch = block.match(/<strong[^>]*>([^<]+)/);
        title = strongMatch ? strongMatch[1] : null;
      } else {
        title = titleMatch[1];
      }
      if (!title) continue;
      title = title.trim();

      let poster = null;
      const dataOrigMatch = block.match(/<img[^>]*data-original\s*=\s*"([^"]+)"/);
      if (dataOrigMatch) {
        poster = dataOrigMatch[1];
      } else {
        const srcMatch = block.match(/<img[^>]*src\s*=\s*"([^"]+)"/);
        if (srcMatch) poster = srcMatch[1];
      }
      if (poster && !poster.startsWith('http')) poster = new URL(poster, BASE).href;

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const blowjobs = {
  needsProxy: true,
  async mainpage() {
    const results = [];
    for (const section of SECTIONS) {
      const { html, url } = await fetchPage(section.url);
      results.push({ name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) });
    }
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/${query}/`;
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
