/**
 * Check actual item blocks for remaining failing providers
 */
import { fetchPage } from './src/providers/helpers.js';

const providers = [
  ['shameless', 'https://shameless.com/latest-updates/', 'videos', 'card-info'],
  ['shyfap', 'https://www.shyfap.net', 'video', 'catalog_item'],
  ['spankbang', 'https://spankbang.com/trending_videos/', 'video', 'js-video-item'],
  ['taboodude', 'https://www.taboodude.com/new/', 'video', 'item'],
  ['xxxtube', 'https://x-x-x.tube/videos/', 'video', 'catalog_item'],
  ['pornhat', 'https://www.pornhat.com', 'video', 'item'],
];

async function check() {
  for (const [name, url, lookFor, marker] of providers) {
    console.log(`\n═══ ${name} ═══`);
    const { html, status } = await fetchPage(url).catch(e => ({ html: '', status: 0 }));
    console.log(`Status: ${status}, Size: ${html.length}`);
    if (html.length < 1000) continue;

    // Find items
    const itemStart = html.indexOf(marker);
    if (itemStart >= 0) {
      console.log(`\nFirst '${marker}' at ${itemStart}:`);
      console.log(html.substring(Math.max(0, itemStart - 50), itemStart + 600));
    }

    // Find video links
    const linkIdx = html.indexOf('/' + lookFor + '/');
    if (linkIdx >= 0) {
      console.log(`\nFirst '/${lookFor}/' link:`);
      console.log(html.substring(Math.max(0, linkIdx - 200), linkIdx + 300));
    }

    // Check for items div
    const divIdx = html.indexOf('class="item');
    if (divIdx >= 0) {
      console.log(`\nFirst 'class="item':`);
      console.log(html.substring(Math.max(0, divIdx - 100), divIdx + 500));
    }
  }
}

check().catch(err => console.error('Fatal:', err));
