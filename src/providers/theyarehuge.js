import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://www.theyarehuge.com';

const SECTIONS = [
  { name: 'Recent', url: `${BASE}/recent/` },
  { name: 'Trending', url: `${BASE}/popular.porn-video/` },
  { name: 'Top Rated', url: `${BASE}/top-rated-videos/` },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<a[^>]*class="[^"]*item[^"]*drclass[^"]*"[\s\S]*?<\/a>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/href\s*=\s*"([^"]+?)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<div[^>]*class="video-title"[^>]*>([^<]+)/);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /<img[^>]*class="thumb\s*"[^>]*src="([^"]+)/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const theyarehuge = {
  async mainpage() {
    const results = await Promise.all(SECTIONS.map(async (section) => {
      const { html, url } = await fetchPage(section.url);
      return { name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) };
    }));
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/${query}/${page}/`;
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
