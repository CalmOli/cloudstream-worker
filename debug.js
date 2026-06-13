/**
 * Debug script to see the actual HTML structure
 */
import { fetchPage, extractFirst, extractAll } from './src/providers/helpers.js';

async function debug() {
  const { html, url, status } = await fetchPage('https://www.analdin.com/latest-updates/');
  console.log(`Status: ${status}`);
  console.log(`Final URL: ${url}`);
  console.log(`HTML size: ${html.length} bytes\n`);

  // Check for Cloudflare challenge
  if (html.includes('cf-browser-verify') || html.includes('cf-challenge') || html.includes('cloudflare')) {
    console.log('❌ Cloudflare challenge detected!');
  }

  // Show first 3000 chars
  console.log('=== First 3000 chars ===');
  console.log(html.substring(0, 3000));
}

debug().catch(err => {
  console.error('Debug failed:', err);
  process.exit(1);
});
