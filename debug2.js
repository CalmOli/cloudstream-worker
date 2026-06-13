/**
 * Debug script to find item structure in HTML
 */
import { fetchPage } from './src/providers/helpers.js';

async function debug() {
  const { html } = await fetchPage('https://www.analdin.com/latest-updates/');

  // Search for common patterns
  const patterns = [
    'div.item',
    'class="item"', 
    'class=\'item\'',
    'video-item',
    'margin-fix',
    'list-videos',
    'strong.title',
    'popup-video-link',
    'lazy-load',
    'data-original',
  ];

  for (const pat of patterns) {
    const idx = html.indexOf(pat);
    if (idx >= 0) {
      console.log(`Found '${pat}' at position ${idx}`);
      console.log('Context:', html.substring(Math.max(0, idx - 200), idx + 300));
      console.log('---');
    } else {
      console.log(`NOT found: '${pat}'`);
    }
  }

  // Look for the video list container
  const listIdx = html.indexOf('list-videos');
  if (listIdx >= 0) {
    console.log('\n=== List videos area ===');
    console.log(html.substring(listIdx, listIdx + 3000));
  }
}

debug().catch(err => {
  console.error('Debug failed:', err);
  process.exit(1);
});
