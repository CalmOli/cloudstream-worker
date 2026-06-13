import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://www.javbangers.com';

const SECTIONS = [
  { name: 'Latest Videos', url: `${BASE}/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const seen = new Set();
  const itemRe = /<a[^>]*href="[^"]*\/video\/[^"]*"[\s\S]*?<\/a>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/href\s*=\s*"([^"]+?)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;
      if (seen.has(url)) continue;
      seen.add(url);

      const titleAttrMatch = block.match(/title\s*=\s*"([^"]+)"/);
      let title = titleAttrMatch ? titleAttrMatch[1] : null;
      if (!title) {
        const imgAltMatch = block.match(/<img[^>]*alt\s*=\s*"([^"]+)"/);
        title = imgAltMatch ? imgAltMatch[1] : null;
      }
      if (!title) continue;
      title = title.trim();

      let poster = null;
      const coverMatch = block.match(/<img[^>]*class="[^"]*cover[^"]*lazy-load[^"]*"[^>]*data-original\s*=\s*"([^"]+)"/);
      if (coverMatch) {
        poster = coverMatch[1];
      } else {
        const thumbMatch = block.match(/<img[^>]*class="[^"]*thumb[^"]*lazy-load[^"]*"[^>]*data-original\s*=\s*"([^"]+)"/);
        if (thumbMatch) poster = thumbMatch[1];
      }
      if (poster && !poster.startsWith('http')) poster = new URL(poster, BASE).href;

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const javbangers = {
  async mainpage() {
    const results = [];
    for (const section of SECTIONS) {
      const { html, url } = await fetchPage(section.url);
      results.push({ name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) });
    }
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/?q=${query}`;
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
