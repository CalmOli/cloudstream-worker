import { providers } from './providers/index.js';
import { extractSourcesFromPage, fetchPage } from './providers/helpers.js';

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
          // Use provider's own sources if non-empty, otherwise extract from page
          let sources = pageResult.sources;
          if (!sources || sources.length === 0) {
            sources = await extractSourcesFromPage(videoUrl, { resolveRedirects: true });
          }
          // Use HTML from provider if available (avoid redundant fetch), otherwise fetch
          let html = pageResult.html || null;
          if (!html) {
            try {
              const page = await fetchPage(videoUrl);
              html = page.html;
            } catch {}
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
