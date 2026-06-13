/**
 * Extract actual item blocks from HTML
 */
import { fetchPage } from './src/providers/helpers.js';

async function debug() {
  const { html } = await fetchPage('https://www.analdin.com/latest-updates/');

  // Find the items container
  const start = html.indexOf('list_videos_latest_videos_list_items');
  if (start < 0) {
    console.log('Could not find items container');
    return;
  }

  // Find the enclosing div
  const divStart = html.lastIndexOf('<div', start);
  const itemsSection = html.substring(divStart, divStart + 5000);
  
  console.log('=== Items section (first 5000 chars) ===');
  console.log(itemsSection);
}

debug().catch(err => {
  console.error('Debug failed:', err);
  process.exit(1);
});
