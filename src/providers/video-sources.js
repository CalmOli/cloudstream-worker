/**
 * Extract video sources from HTML using multiple strategies.
 * @param {string} html - Page HTML
 * @param {object} [opts] - Optional filters
 * @param {string|number} [opts.videoId] - Only include get_file URLs with this video ID
 * Returns [{ url, quality }]
 */
export function extractVideoSources(html, opts = {}) {
  const sources = [];
  const seen = new Set();

  function addSource(rawUrl, quality = null) {
    if (!rawUrl) return;
    let url = rawUrl.replace(/^function\/\d+\//, '').replace(/\/$/, '');
    if (seen.has(url)) return;
    seen.add(url);
    let q = quality;
    if (!q) {
      const u = url.toLowerCase();
      if (u.includes('2160') || u.includes('4k')) q = '2160p';
      else if (u.includes('1080') || u.includes('fullhd')) q = '1080p';
      else if ((u.includes('720') || u.includes('hd')) && !u.includes('480')) q = '720p';
      else if (u.includes('240')) q = '240p';
      else if (u.includes('480')) q = '480p';
      else if (u.includes('360')) q = '360p';
      else if (u.includes('sd')) q = '480p';
      else q = '480p';
    }
    sources.push({ url, quality: q });
  }

  let m;

  // Strategy 1: video_url JS vars
  const vidRe = /video_(?:alt_)?url\d*\s*:\s*['"]([^'"]+)['"]/g;
  while ((m = vidRe.exec(html)) !== null) addSource(m[1]);

  // Strategy 2: video source[src] with label
  const srcRe = /<source[^>]*?src\s*=\s*"([^"]+)"[^>]*?(?:label|title)\s*=\s*"([^"]+)"/gi;
  while ((m = srcRe.exec(html)) !== null) {
    if (m[1] && !m[1].includes('vthumb') && !m[1].includes('_preview') && !m[1].includes('screenshots')) addSource(m[1], m[2]);
  }

  // Strategy 2b: source without label
  const srcNoLbl = /<source[^>]*?src\s*=\s*"([^"]+?\.mp4[^"]*)"/gi;
  while ((m = srcNoLbl.exec(html)) !== null) {
    if (!m[1].includes('vthumb') && !m[1].includes('_preview')) addSource(m[1]);
  }

  // Strategy 3: get_file
  const getFileRe = /https?:\/\/[^"'\s<>]+get_file[^"'\s<>]*\.mp4/g;
  while ((m = getFileRe.exec(html)) !== null) {
    const u = m[0];
    if (u.includes('_preview') || u.includes('vthumb') || u.includes('trailer') || u.includes('screenshots') || u.includes('.jpg')) continue;
    if (opts.videoId && !u.includes(`/${opts.videoId}/`) && !u.includes(`/${opts.videoId}_`) && !u.includes(`/${opts.videoId}.`)) continue;
    addSource(u);
  }

  // Strategy 4: bkcdn/bxcdn
  const cdnRe = /https?:\/\/[^"'\s<>]+(?:bkcdn|bxcdn)[^"'\s<>]+\.mp4/g;
  while ((m = cdnRe.exec(html)) !== null) addSource(m[0]);

  // Strategy 5: JSON-LD contentUrl
  const jsonRe = /"contentUrl"\s*:\s*"([^"]+)"/g;
  while ((m = jsonRe.exec(html)) !== null) addSource(m[1]);

  // Strategy 6: video[src]
  const vidSrcRe = /<video[^>]*?src\s*=\s*"([^"]+)"[^>]*>/gi;
  while ((m = vidSrcRe.exec(html)) !== null) {
    if (m[1].endsWith('.mp4') || m[1].includes('get_file')) addSource(m[1]);
  }

  return sources;
}
