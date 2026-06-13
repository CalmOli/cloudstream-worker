/**
 * Deeper debug of failing providers - find actual item structures
 */
import { fetchPage, extractFirst } from './src/providers/helpers.js';

const targets = [
  // name, url, item regex to try, title pattern, poster pattern
  ['sexu', 'https://sexu.com', 'grid__item', 'item__title', 'item__inner', 'thumb'],
  ['taboodude', 'https://www.taboodude.com/latest-updates/', 'class="item', 'strong.title', 'data-original', 'thumb'],
  ['spankbang', 'https://spankbang.com/trending_videos/', 'js-video-item', 'img[alt]', 'img[src]', 'video'],
  ['xxxtube', 'https://x-x-x.tube/videos/', 'catalog_item', 'media-card_title', 'data-preview', 'preview'],
  ['yespornvip', 'https://yesporn.vip/latest-updates/', 'loop-video', 'entry-header', 'data-src', 'thumb-block'],
  ['shyfap', 'https://www.shyfap.net', 'catalog_item', 'media-card_title', 'data-preview', 'preview'],
  ['freeuseporn', 'https://www.freeuseporn.com', 'video-item', 'a[title]', 'img', 'thumb'],
];

async function check() {
  for (const [name, url, marker, titleMarker, posterMarker, altMarker] of targets) {
    console.log(`\n╔══ ${name} ══╗`);
    
    const result = await fetchPage(url);
    console.log(`Status: ${result.status}, Size: ${result.html.length}`);

    if (result.html.length < 500) {
      console.log(`❌ Blocked/minimal response`);
      continue;
    }

    // Count markers
    const checks = [marker, titleMarker, posterMarker, altMarker, 'href="/video', 'href="/videos', '<a href'];
    for (const c of checks) {
      const re = new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const count = (result.html.match(re) || []).length;
      if (count > 0) {
        console.log(`  '${c}': ${count}`);
      }
    }

    // Show context around first item occurrence
    const idx = result.html.indexOf(marker);
    if (idx >= 0) {
      const ctx = result.html.substring(Math.max(0, idx - 100), idx + 800);
      console.log(`\n  Context around '${marker}':\n${ctx}\n`);
    }

    // For sites with video links, show a sample
    const videoLinkIdx = result.html.indexOf('/video/');
    if (videoLinkIdx >= 0) {
      const linkCtx = result.html.substring(Math.max(0, videoLinkIdx - 200), videoLinkIdx + 400);
      console.log(`  Sample video link context:\n${linkCtx}\n`);
    }
  }
}

check().catch(err => console.error('Fatal:', err));
