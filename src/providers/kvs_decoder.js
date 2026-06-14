export function kvsGetLicenseToken(licenseCode) {
  const cleaned = licenseCode.replace('$', '');
  const licenseValues = [...cleaned].map(c => parseInt(c, 10));

  const modlicense = cleaned.replace(/0/g, '1');
  const center = Math.floor(modlicense.length / 2);
  const fronthalf = parseInt(modlicense.substring(0, center + 1), 10);
  const backhalf = parseInt(modlicense.substring(center), 10);
  const newMod = String(4 * Math.abs(fronthalf - backhalf)).substring(0, center + 1);

  const token = [];
  for (let index = 0; index < newMod.length; index++) {
    const current = parseInt(newMod[index], 10);
    for (let offset = 0; offset < 4; offset++) {
      token.push((licenseValues[index + offset] + current) % 10);
    }
  }
  return token;
}

export function kvsDecodeUrl(videoUrl, licenseCode) {
  if (!videoUrl.startsWith('function/0/')) return videoUrl;

  const urlStr = videoUrl.substring('function/0/'.length);
  const parsed = new URL(urlStr);
  const urlparts = parsed.pathname.split('/');

  const HASH_LENGTH = 32;
  if (urlparts.length > 3 && urlparts[3] && urlparts[3].length >= HASH_LENGTH) {
    const hash = urlparts[3];
    const licenseToken = kvsGetLicenseToken(licenseCode);
    const indices = Array.from({ length: HASH_LENGTH }, (_, i) => i);

    let accum = 0;
    for (let src = HASH_LENGTH - 1; src >= 0; src--) {
      accum += licenseToken[src];
      const dest = (src + accum) % HASH_LENGTH;
      const tmp = indices[src];
      indices[src] = indices[dest];
      indices[dest] = tmp;
    }

    const unshuffled = indices.map(idx => hash[idx]).join('');
    urlparts[3] = unshuffled + hash.substring(HASH_LENGTH);

    parsed.pathname = urlparts.join('/');
    return parsed.toString();
  }

  return urlStr;
}
