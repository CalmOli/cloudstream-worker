import { fetchPage } from './src/providers/helpers.js';

const url = 'https://shameless.com/latest-updates/';
const { html } = await fetchPage(url);

const exact = '<div class="item card">';
console.log('Exact match count:', html.split(exact).length - 1);

// Show what's around it
const idx = html.indexOf(exact);
if (idx >= 0) {
  console.log('Found at:', idx);
  console.log('Before:', JSON.stringify(html.substring(idx - 5, idx)));
  console.log('Match:', JSON.stringify(html.substring(idx, idx + exact.length)));
  console.log('After:', JSON.stringify(html.substring(idx + exact.length, idx + exact.length + 50)));
}

// Try the split
const parts = html.split(exact);
console.log('Split parts:', parts.length);
if (parts.length > 1) {
  console.log('Part 1 length:', parts[1].length);
  console.log('Part 1 start:', parts[1].substring(0, 200));
}
