/**
 * Debug failing providers - check actual HTML structure
 */
import { fetchPage, extractFirst } from './src/providers/helpers.js';

const toCheck = [
  ['freeuseporn', 'https://www.freeuseporn.com', 'video-item'],
  ['sexu', 'https://sexu.com', 'grid__item'],
  ['shyfap', 'https://www.shyfap.net', 'catalog_item'],
  ['spankbang', 'https://spankbang.com/trending_videos/', 'js-video-item'],
  ['taboodude', 'https://www.taboodude.com/latest-updates/', 'item'],
  ['xxxtube', 'https://x-x-x.tube/videos/', 'catalog_item'],
  ['yespornvip', 'https://yesporn.vip/latest-updates/', 'loop-video'],
  ['pornhat', 'https://www.pornhat.com', 'item'],
  ['shameless', 'https://shameless.com/latest-updates/', 'card'],
  ['theyarehuge', 'https://www.theyarehuge.com/recent/', 'item.drclass'],
];

async function check() {
  for (const [name, url, expectedClass] of toCheck) {
    console.log(`\n=== ${name} ===`);
    console.log(`URL: ${url}`);
    
    const { html, status } = await fetchPage(url);
    console.log(`Status: ${status}, Size: ${html.length} bytes`);

    if (html.length < 500) {
      console.log(`❌ TOO SMALL - might be blocked`);
      console.log(html.substring(0, 500));
      continue;
    }

    // Check for various markers
    const markers = [
      expectedClass,
      'class="item',
      'href="/video',
      'href="/videos',
      'poster',
      'og:title',
      'data-original',
      'data-src',
      'img src',
      'thumbnail',
      'thumb',
      'video-title',
    ];

    for (const m of markers) {
      const count = (html.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
      if (count > 0) {
        console.log(`  Found '${m}': ${count} times`);
      }
    }

    // Show first 2000 chars
    console.log('\n  First 2000 chars:');
    console.log(html.substring(0, 2000));
  }
}

check().catch(err => {
  console.error('Debug failed:', err);
  process.exit(1);
});
