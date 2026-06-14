export const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function parseCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  return setCookieHeader
    .split(/,(?=\s*\w+=)/)
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

export async function fetchPage(url, options = {}) {
  const { referer, ua = DEFAULT_UA, timeout = 20000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...(referer ? { Referer: referer } : {}),
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    const rawCookies = resp.headers.get('set-cookie') || '';
    const cookies = parseCookies(rawCookies);
    return {
      html: await resp.text(),
      status: resp.status,
      url: resp.url,
      cookies,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract first match of a regex capture group from HTML
 */
export function extractFirst(html, regex) {
  const m = new RegExp(regex).exec(html);
  return m ? (m[1] !== undefined ? m[1] : m[0]) : null;
}

/**
 * Extract all matches of a regex from HTML
 */
export function extractAll(html, regex) {
  const results = [];
  let match;
  const re = new RegExp(regex, 'g');
  while ((match = re.exec(html)) !== null) {
    results.push(match[1] !== undefined ? match[1] : match[0]);
  }
  return results;
}

function qualityFromUrl(url) {
  if (url.includes('2160') || url.includes('4k')) return 2160;
  if (url.includes('1080')) return 1080;
  if (url.includes('720')) return 720;
  if (url.includes('480')) return 480;
  if (url.includes('360')) return 360;
  return 0;
}

function isPreviewUrl(url) {
  return /_preview|_vthumb|screenshots|\.jpg|_trailer|preview\.mp4|\/sexu-preview\/|\/preview\//i.test(url);
}

/**
 * Extract video sources from a page HTML using multiple strategies.
 * Returns [{ url, quality }] - all unique, non-preview, non-thumbnail sources.
 * Primary sources (from <source> tags and og:video) are listed first.
 */
export function extractVideoSources(html, pageUrl) {
  const seen = new Set();
  const primary = [];
  const secondary = [];

  function addToList(list, url, quality = 0) {
    let cleaned = url.replace(/\/+$/, '');
    // get_file URLs require trailing slash (routing), preserve it
    if (cleaned !== url && url.includes('/get_file/')) cleaned = url;
    if (!cleaned || seen.has(cleaned)) return;
    if (isPreviewUrl(cleaned)) return;
    if (/\/thumbs?\//i.test(cleaned) && !/\/videos?\//i.test(cleaned)) return;
    seen.add(cleaned);
    list.push({ url: cleaned, quality: quality > 0 ? quality : qualityFromUrl(cleaned) });
  }

  let m;

  // Strategy 1: <source src> tags (PRIMARY)
  const srcRe = /<source[^>]*src\s*=\s*['"]([^'"]+)['"]/gi;
  while ((m = srcRe.exec(html)) !== null) {
    let u = m[1];
    if (u.startsWith('//')) u = 'https:' + u;
    addToList(primary, u);
  }

  // Strategy 2: og:video meta tags (PRIMARY)
  const ogRe = /<meta[^>]*(?:property|name)\s*=\s*['"](?:og:video(?::url|:secure_url)?|twitter:player)['"][^>]*content\s*=\s*['"]([^'"]+)['"]/gi;
  while ((m = ogRe.exec(html)) !== null) {
    let u = m[1];
    if (u.startsWith('//')) u = 'https:' + u;
    addToList(primary, u);
  }
  const ogRe2 = /<meta[^>]*content\s*=\s*['"]([^'"]+)['"][^>]*(?:property|name)\s*=\s*['"](?:og:video(?::url|:secure_url)?|twitter:player)['"]/gi;
  while ((m = ogRe2.exec(html)) !== null) {
    let u = m[1];
    if (u.startsWith('//')) u = 'https:' + u;
    addToList(primary, u);
  }

  // Strategy 3: video_url JS variable (SECONDARY)
  const urlRe = /video_url\s*:\s*['"]([^'"]+)['"]/g;
  while ((m = urlRe.exec(html)) !== null) {
    const u = m[1];
    if (u.startsWith('function/')) continue;
    addToList(secondary, u);
  }

  // Strategy 4: get_file URLs (SECONDARY)
  const gfRe = /https?:\/\/[^"'\s<>]+get_file[^"'\s<>]*\.mp4[^"'\s<>]*/g;
  while ((m = gfRe.exec(html)) !== null) {
    addToList(secondary, m[0]);
  }

  // Strategy 5: direct .mp4 URLs (SECONDARY)
  const mp4Re = /https?:\/\/[^"'\s<>]+\.mp4(?!\/[^"'\s<>]*\.(?:jpg|png|gif|webp))[^"'\s<>]*/g;
  while ((m = mp4Re.exec(html)) !== null) {
    addToList(secondary, m[0]);
  }

  // Strategy 6: HLS/m3u8 URLs (SECONDARY)
  const m3u8Re = /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/g;
  while ((m = m3u8Re.exec(html)) !== null) {
    addToList(secondary, m[0]);
  }

  // Strategy 7: wp-content upload .mp4 URLs (SECONDARY)
  const wpRe = /https?:\/\/[^"'\s<>]*wp-content\/uploads\/[^"'\s<>]+\.mp4[^"'\s<>]*/g;
  while ((m = wpRe.exec(html)) !== null) {
    addToList(secondary, m[0]);
  }

  // Only use secondary (broad regex) sources if primary found nothing
  // This prevents picking up unrelated video URLs from the page sidebar/related videos
  if (primary.length === 0) {
    const primaryUrls = new Set(primary.map(s => s.url));
    for (const s of secondary) {
      if (!primaryUrls.has(s.url)) {
        primary.push(s);
      }
    }
  }

  return primary;
}

/**
 * Try to follow a get_file redirect to find the final CDN URL.
 * Returns the redirected URL or the original if no redirect.
 */
export async function resolveVideoUrl(videoUrl, referer, cookies = '') {
  try {
    const headers = { 'User-Agent': DEFAULT_UA, Referer: referer || videoUrl };
    if (cookies) headers['Cookie'] = cookies;
    const resp = await fetch(videoUrl, {
      method: 'HEAD',
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const location = resp.headers.get('location');
    if (location) {
      // Follow redirect to CDN - HEAD first, fall back to range request for CDNs that block HEAD
      for (const method of ['HEAD', 'GET']) {
        try {
          const headers2 = { 'User-Agent': DEFAULT_UA, Referer: referer || videoUrl };
          if (cookies) headers2['Cookie'] = cookies;
          if (method === 'GET') headers2['Range'] = 'bytes=0-0';
          const resp2 = await fetch(location, {
            method,
            headers: headers2,
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),
          });
          const ct = resp2.headers.get('content-type') || '';
          if (resp2.ok || !ct.includes('text/html')) {
            const isM3u8 = ct.includes('mpegurl') || ct.includes('m3u') || resp2.url.includes('.m3u8');
            return { url: resp2.url, status: resp2.status, contentType: ct, isM3u8 };
          }
        } catch {}
      }
      // If all methods failed, use the first redirect URL directly
      return { url: location, status: 302, contentType: 'video/redirect', isM3u8: true };
    }
    const ct = resp.headers.get('content-type') || '';
    return { url: videoUrl, status: resp.status, contentType: ct, isM3u8: ct.includes('mpegurl') || ct.includes('m3u') };
  } catch {
    return { url: videoUrl, status: 0, contentType: '', isM3u8: false };
  }
}

/**
 * Resolve ok.ru API URL to m3u8 video URLs.
 * The ok.ru API returns JSON with video URLs inside playerInfo.videos[].
 */
export async function resolveOkruUrl(apiUrl, referer) {
  try {
    const resp = await fetch(apiUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        Referer: referer || apiUrl,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    const videos = json?.playerInfo?.videos || json?.videos || [];
    return videos
      .filter(v => v.url)
      .map(v => ({
        url: v.url,
        quality: parseInt(v.quality) || parseInt(v.name) || 0,
        isM3u8: true,
      }));
  } catch {
    return [];
  }
}

/**
 * Full video source extraction for a page URL.
 * Fetches the page, extracts sources, optionally resolves get_file redirects.
 */
export async function extractSourcesFromPage(pageUrl, options = {}) {
  const { resolveRedirects = false, html: preFetchedHtml, cookies = '' } = options;
  const html = preFetchedHtml || (await fetchPage(pageUrl)).html;
  const sources = extractVideoSources(html, pageUrl);

  if (resolveRedirects && sources.length > 0) {
    const results = await Promise.all(sources.map(src => resolveVideoUrl(src.url, pageUrl, cookies)));
    const resolved = sources.map((src, i) => {
      const result = results[i];
      if (result.status > 0 && !result.contentType.includes('text/html')) {
        return { url: result.url, quality: src.quality, isM3u8: result.isM3u8 || false };
      }
      const isM3u8 = src.url.includes('.m3u8');
      return { ...src, isM3u8 };
    });
    return resolved;
  }

  // Mark m3u8 URLs even without redirect resolution
  return sources.map(s => ({ ...s, isM3u8: s.url.includes('.m3u8') }));

  return sources;
}
