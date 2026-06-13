import { fetchPage } from './src/providers/helpers.js';

const url = 'https://shameless.com/latest-updates/';

const { html, status } = await fetchPage(url);
console.log('Status:', status, 'Size:', html.length);

for (const m of ['item card', 'card-body', 'card-info__text', 'data-src', 'href="/videos/']) {
  const c = (html.match(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
  console.log('  ' + m + ':', c);
}

const idx = html.indexOf('card-body');
if (idx >= 0) {
  console.log('\nContext around first card-body:');
  console.log(html.substring(idx, idx + 700));
}

// Also check if the item+card combo works
const itemCard = html.match(/<div\s+class="item\s+card"/g);
console.log('\nitem card matches:', itemCard ? itemCard.length : 0);

// Show one full item block
const fullItem = html.match(/<div\s+class="item\s+card"[\s\S]*?<\/div>\s*<\/div>/);
if (fullItem) {
  console.log('\nFull item block:');
  console.log(fullItem[0]);
} else {
  // Try simpler regex
  const parts = html.split('<div class="item card"');
  console.log('Split parts:', parts.length);
  if (parts.length > 1) {
    console.log('\nAfter first split:');
    console.log(parts[1].substring(0, 600));
  }
}
