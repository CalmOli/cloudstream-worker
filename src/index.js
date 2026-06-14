import { providers } from './providers/index.js';
import { extractSourcesFromPage, fetchPage, DEFAULT_UA } from './providers/helpers.js';
import { getStreamUrls, getSiteTag, isApiProvider } from './pornapi.js';
import { kvsDecodeUrl } from './providers/kvs_decoder.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

const ALIASES = {
  taboodudecom: 'taboodude',
};

function getProvider(name) {
  const key = name.toLowerCase();
  const alias = ALIASES[key];
  return providers[alias || key] || null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'api') return err('Use /api/mainpage, /api/search, /api/load, or /api/loadlinks', 404);

    const action = parts[1];

    // resolve_url doesn't need a provider
    if (action === 'resolve_url') {
      const targetUrl = url.searchParams.get('url');
      const ref = url.searchParams.get('ref') || '';
      const cookieStr = url.searchParams.get('cookies') || '';
      if (!targetUrl) return err('Missing url');
      const results = {};
      for (const method of ['HEAD', 'GET']) {
        try {
          const headers = { 'User-Agent': DEFAULT_UA, Referer: ref || targetUrl };
          if (cookieStr) headers['Cookie'] = cookieStr;
          if (method === 'GET') headers['Range'] = 'bytes=0-0';
          const resp = await fetch(targetUrl, {
            method, redirect: 'manual', headers, signal: AbortSignal.timeout(10000),
          });
          results[method] = { status: resp.status, ct: resp.headers.get('content-type'), location: resp.headers.get('location'), url: resp.url };
        } catch (e) {
          results[method] = { error: e.message };
        }
      }
      return json(results);
    }

    // Image proxy: fetches images with referer header (for sites whose CDN requires it)
    if (action === 'img') {
      const imgUrl = url.searchParams.get('url');
      const ref = url.searchParams.get('ref') || '';
      if (!imgUrl) return err('Missing url');
      try {
        const resp = await fetch(imgUrl, {
          method: 'GET', redirect: 'follow',
          headers: { 'User-Agent': DEFAULT_UA, 'Referer': ref || imgUrl },
          signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) return err(`Image fetch failed: ${resp.status}`, resp.status);
        const ct = resp.headers.get('content-type') || 'image/jpeg';
        return new Response(resp.body, {
          status: 200,
          headers: { ...CORS, 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' },
        });
      } catch (e) {
        return err(`Image proxy error: ${e.message}`, 502);
      }
    }

    // Video proxy endpoint: Worker fetches the video page, extracts fresh video URLs,
    // and streams the first successful result to the phone.
    // Params: vid = video page URL, provider = provider name
    if (action === 'stream') {
      const vid = url.searchParams.get('vid');
      const providerName = url.searchParams.get('provider');
      if (!vid || !providerName) return err('Missing vid or provider');
      try {
        const prov = getProvider(providerName);
        if (!prov) return err('Unknown provider');
        const pageResult = await prov.loadlinks(vid);
        const cookies = pageResult.cookies || '';
        if (!pageResult.sources || pageResult.sources.length === 0) return err('No sources found', 404);
        // Try each source: prefer CDN (non-get_file) URLs, stream the first one that works
        for (const src of pageResult.sources) {
          const url = src.url;
          try {
            const headers = { 'User-Agent': DEFAULT_UA, Referer: vid };
            if (cookies) headers['Cookie'] = cookies;
            const resp = await fetch(url, {
              method: 'GET', redirect: 'follow', headers, signal: AbortSignal.timeout(30000),
            });
            if (resp.ok || resp.status === 206) {
              const responseHeaders = {
                ...CORS,
                'Content-Type': resp.headers.get('content-type') || 'video/mp4',
                'Accept-Ranges': 'bytes',
                ...(resp.headers.get('content-length') ? { 'Content-Length': resp.headers.get('content-length') } : {}),
                ...(resp.headers.get('content-range') ? { 'Content-Range': resp.headers.get('content-range') } : {}),
              };
              return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: responseHeaders });
            }
          } catch {}
        }
        return err('All sources failed', 502);
      } catch (e) {
        return err(`Stream error: ${e.message}`, 500);
      }
    }

    const providerName = url.searchParams.get('provider');
    if (!providerName) return err('Missing provider parameter');
    const provider = getProvider(providerName);
    if (!provider) return err(`Unknown provider: ${providerName}. Available: ${Object.keys(providers).join(', ')}`);

    try {
      switch (action) {
        case 'mainpage': return json(await provider.mainpage());
        case 'search': {
          const query = url.searchParams.get('q');
          if (!query) return err('Missing q parameter for search');
          return json(await provider.search(query, parseInt(url.searchParams.get('page') || '1', 10)));
        }
        case 'load': {
          const videoUrl = url.searchParams.get('url');
          if (!videoUrl) return err('Missing url parameter for load');
          return json(await provider.load(videoUrl));
        }
        case 'loadlinks': {
          const videoUrl = url.searchParams.get('url');
          if (!videoUrl) return err('Missing url parameter for loadlinks');
          const pageResult = await provider.loadlinks(videoUrl);

          // Get HTML and cookies from provider if available, otherwise fetch
          let html = pageResult.html || null;
          let cookies = pageResult.cookies || '';
          if (!html) {
            try {
              const page = await fetchPage(videoUrl);
              html = page.html;
              cookies = page.cookies;
            } catch {}
          }

          // Resolve sources: API is primary (returns working CDN URLs),
          // fall back to page extraction only if API fails
          let sources = null;
          if (isApiProvider(providerName) && html) {
            const siteTag = getSiteTag(providerName);
            const apiSources = await getStreamUrls(siteTag, html, videoUrl);
            if (apiSources && apiSources.length > 0) {
              sources = apiSources;
            }
          }
          if (!sources || sources.length === 0) {
            sources = pageResult.sources;
            if (!sources || sources.length === 0) {
              sources = await extractSourcesFromPage(videoUrl, { resolveRedirects: true });
            }
          }
          // KVS decoding: unscramble get_file URL hashes using license_code from page
          if (html && sources) {
            const licenseMatch = html.match(/license_code\s*:\s*['"]([^'"]+)['"]/i);
            if (licenseMatch) {
              const licenseCode = licenseMatch[1];
              const functionMatches = [...html.matchAll(/(video_url|video_alt_url\d*):\s*['"](function\/\d+\/[^'"]+)['"]/gi)];
              const decodedMap = new Map();
              for (const m of functionMatches) {
                try {
                  const decoded = kvsDecodeUrl(m[2], licenseCode);
                  const cleanScrambled = m[2].replace(/^function\/\d+\//, '');
                  if (decoded && decoded !== cleanScrambled) {
                    decodedMap.set(cleanScrambled, decoded);
                  }
                } catch {}
              }
              if (decodedMap.size > 0) {
                sources = sources.map(src => {
                  const fixed = decodedMap.get(src.url);
                  return fixed ? { ...src, url: fixed } : src;
                });
              }
            }
          }

          // Resolve get_file URLs: try multiple methods to find CDN URL
          if (sources) {
            sources = await Promise.all(sources.map(async (src) => {
              if (!src.url.includes('/get_file/')) return src;
              const attempts = [
                { method: 'GET', headers: { 'User-Agent': DEFAULT_UA, Referer: videoUrl, 'Range': 'bytes=0-0' } },
                { method: 'GET', headers: { 'User-Agent': DEFAULT_UA, Referer: videoUrl } },
                { method: 'HEAD', headers: { 'User-Agent': DEFAULT_UA, Referer: videoUrl } },
              ];
              for (const attempt of attempts) {
                try {
                  if (cookies) attempt.headers['Cookie'] = cookies;
                  const resp = await fetch(src.url, {
                    method: attempt.method,
                    redirect: 'follow',
                    headers: attempt.headers,
                    signal: AbortSignal.timeout(20000),
                  });
                  const finalUrl = resp.url;
                  const ct = resp.headers.get('content-type') || '';
                  if (finalUrl !== src.url && !finalUrl.includes('/get_file/')) {
                    const isM3u8 = ct.includes('m3u') || finalUrl.includes('.m3u8');
                    return { url: finalUrl, quality: src.quality, isM3u8 };
                  }
                } catch {}
              }
              return src;
            }));
          }
          // Fallback: try fresh embed page extraction for sites with aggressive token expiry
          if (sources && sources.every(s => s.url.includes('/get_file/')) && html) {
            const iframeSrc = html.match(/<iframe[^>]+src="([^"]*\/embed\/[^"]+)"/i);
            if (iframeSrc) {
              let embedUrl = iframeSrc[1];
              if (!embedUrl.startsWith('http')) embedUrl = new URL(embedUrl, videoUrl).href;
              try {
                const ep = await fetchPage(embedUrl);
                const vu = ep.html.match(/video_url[^:]*:\s*['"]function\/\d+\/(https?:\/\/[^'"]+)['"]/i);
                if (vu) {
                  const resp = await fetch(vu[1], {
                    method: 'GET', redirect: 'follow',
                    headers: { 'User-Agent': DEFAULT_UA, Referer: embedUrl, 'Cookie': ep.cookies },
                    signal: AbortSignal.timeout(20000),
                  });
                  if (resp.url !== vu[1] && !resp.url.includes('/get_file/')) {
                    sources = [{ url: resp.url, quality: 0, isM3u8: (resp.headers.get('content-type')||'').includes('m3u') || resp.url.includes('.m3u8') }];
                  }
                }
              } catch {}
            }
          }

          // For CDN URLs that are IP-bound (like xascdn.li), wrap in stream proxy
          const baseProxyUrl = url.origin + '/api/stream';
          if (sources) {
            sources = sources.map(s => {
              const u = s.url;
              if (u.includes('xascdn.li')) {
                return { ...s, url: `${baseProxyUrl}?provider=${providerName}&vid=${encodeURIComponent(videoUrl)}` };
              }
              return s;
            });
          }

          return json({
            page: pageResult.page || videoUrl,
            sources,
            html,
          });
        }
        default: return err(`Unknown action: ${action}`, 404);
      }
    } catch (e) {
      return err(`Provider error: ${e.message}`, 500);
    }
  },
};
