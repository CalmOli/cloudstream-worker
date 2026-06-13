/**
 * Test fetching through the existing proxy
 */
async function test() {
  const PROXY = 'https://simple-proxy.mda2233.workers.dev/?destination=';
  const urls = [
    'https://www.analdin.com/latest-updates/',
    'https://bingato.com',
    'https://www.fullvideos.xxx/latest-updates/',
    'https://hardsexvids.com/latest-updates/',
    'https://www.hdporn.gg/latest-updates/',
  ];

  for (const url of urls) {
    try {
      const proxyUrl = PROXY + encodeURIComponent(url);
      const resp = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });
      const html = await resp.text();
      console.log(`${url}: ${resp.status} (${html.length} bytes) - items: ${(html.match(/class="item/g) || []).length}`);
    } catch (err) {
      console.log(`${url}: FAILED - ${err.message}`);
    }
  }
}

test();
