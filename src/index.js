import { providers } from './providers/index.js';
import { extractSourcesFromPage, fetchPage, DEFAULT_UA } from './providers/helpers.js';
import { getStreamUrls, getSiteTag, isApiProvider } from './pornapi.js';

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

          // Resolve sources: provider → fallback extraction → API
          let sources = pageResult.sources;
          if (!sources || sources.length === 0) {
            sources = await extractSourcesFromPage(videoUrl, { resolveRedirects: true });
          }
          if ((!sources || sources.length === 0) && isApiProvider(providerName) && html) {
            const siteTag = getSiteTag(providerName);
            const apiSources = await getStreamUrls(siteTag, html, videoUrl);
            if (apiSources && apiSources.length > 0) {
              sources = apiSources;
            }
          }
          // Resolve get_file URLs: try multiple methods to find CDN URL
          const resolutions = [];
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
                  resolutions.push({ from: src.url, method: attempt.method, status: resp.status, ct, to: finalUrl, redirected: finalUrl !== src.url });
                  if (finalUrl !== src.url && !finalUrl.includes('/get_file/')) {
                    const isM3u8 = ct.includes('m3u') || finalUrl.includes('.m3u8');
                    return { url: finalUrl, quality: src.quality, isM3u8 };
                  }
                } catch (e) {
                  resolutions.push({ from: src.url, method: attempt.method, error: e.message });
                }
              }
              return src;
            }));
          }

          return json({
            page: pageResult.page || videoUrl,
            sources,
            html,
            _debug: { resolutions },
          });
        }
        default: return err(`Unknown action: ${action}`, 404);
      }
    } catch (e) {
      return err(`Provider error: ${e.message}`, 500);
    }
  },
};
