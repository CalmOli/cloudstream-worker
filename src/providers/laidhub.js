import { fetchPage, extractFirst } from './helpers.js';

const BASE = 'https://www.laidhub.com';

const SECTIONS = [
  { name: 'Latest Videos', url: BASE },
];

function parseItems(html, baseUrl) {
  const items = [];
  const itemRe = /<a[^>]*class="[^"]*thumb[^"]*video-preview-aspect-ratio[^"]*"[\s\S]*?<\/a>/g;
  let match;
  while ((match = itemRe.exec(html)) !== null) {
    const block = match[0];
    try {
      const urlMatch = block.match(/href\s*=\s*"([^"]+?)"/);
      if (!urlMatch) continue;
      let url = urlMatch[1];
      if (!url.startsWith('http')) url = new URL(url, BASE).href;

      let title = extractFirst(block, /<span[^>]*class="title"[^>]*>([^<]+)/) ||
                  extractFirst(block, /<img[^>]*alt="([^"]+)"/i);
      if (!title) continue;
      title = title.trim();

      let poster = extractFirst(block, /<img[^>]*data-oe="shuffle-thumbs"[^>]*src="([^"]+)"/) ||
                   extractFirst(block, /<img[^>]*class="[^"]*lazy[^"]*"[^>]*data-src="([^"]+)"/);

      items.push({ url, title, poster });
    } catch {}
  }
  return items;
}

export const laidhub = {
  async mainpage() {
    const results = [];
    for (const section of SECTIONS) {
      const { html, url } = await fetchPage(section.url);
      results.push({ name: section.name, url: section.url, items: parseItems(html, url).slice(0, 50) });
    }
    return { sections: results };
  },
  async search(query, page = 1) {
    const searchUrl = `${BASE}/search/${query}/page/${page}/`;
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
