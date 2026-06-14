import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';

const API_BASE = 'https://porn-app.com/api/v9';
const PUBKEY_B64 = 'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA2e/sX/U3UNOsCJQHkEK7IF+VG5D1jMSrel8NDYTKVhV5etQg8hW4Lo5wQckpB8mbDz9ZVgy1z647Csh/vSqnpT1Rb3F35xNERrz87WzeoVGqABDNU4l+yqREmjgeyUYyMgAlIGVzhXwZJjOcZl7zcGEuH0H24aZhiQX5XBfcG4Rugnc0QbxUbnblTJD2vNHn4nzEJbz0eBE81YyF/Wkc1P4a55lD3CzDMoqjGNgESyb+9AO2yhY3ux20k7RUkLg62B656kYIQjGBu7tSyLVL08htpQOs/GDpi31sB2a32NPzgj85TNIOXQQ5ZtOZHssYGADtbBKbREYR6mtKQKWG2qf58ns9wYZ2ATqwQAS/brTJYard0pThOh/71ik8aAeyw0jbL5jAhz0wSs679PwTUwvbD6oqd2w8MDr2YG4lyK7jPma1QqzMpKCn/N2YKOU0jjXcj/twaXKSUCr+LiCu7MxBl76j3WoyaI4FsPGXAKFPHQU6bixMY/0XmEezLzwlJ7cf24tLBqADm8ooy92xM6nfALY2bWMgAufqXwPRCfjlec/sOiSTO53P9XiaEUPLGpHUOqCZRFb1vc3v16B4Z1R+B6rYyaVJ9hkQ+x09yExDFxLQOuG7YqJkwq3az1CM0zhMtK48vJrBUkgLzVMWnt3Tycn73ZEINcR183XyFI0CAwEAAQ==';

const PROVIDER_TO_SITETAG = {
  xxxtube: 'xxxtube',
  neporn: 'neporncom',
  xasiat: 'xasiatcom',
  yespornvip: 'yespornvip',
  taboodude: 'taboodudecom',
  taboodudecom: 'taboodudecom',
};

const API_PROVIDERS = new Set(['xxxtube', 'neporn', 'xasiat', 'yespornvip', 'taboodude', 'taboodudecom']);

let cachedHash = '';
let cachedHashTime = 0;

function generateHash() {
  const ts = Math.floor(Date.now() / 1000);
  if (ts - cachedHashTime < 30 && cachedHash) return cachedHash;

  const payload = JSON.stringify({
    id: 'a1b2c3d4e5f6a7b8',
    isTV: false,
    loginStatus: { pro: 0, status: 0, token: '', unixtime: ts, user_id: 0 },
    packageName: 'com.streamdev.aiostreamer',
    signatures: ['VQMyUhZdmnnwK5RVCbeGqu0HN020MEDUM44crQyL1zw='],
    time: ts,
    version: 6643,
  });

  const pem = `-----BEGIN PUBLIC KEY-----\n${(PUBKEY_B64.match(/.{1,64}/g) || []).join('\n')}\n-----END PUBLIC KEY-----`;

  const encrypted = crypto.publicEncrypt(
    { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(payload, 'utf-8')
  );

  cachedHash = encrypted.toString('base64');
  cachedHashTime = ts;
  return cachedHash;
}

function getSiteTag(providerName) {
  return PROVIDER_TO_SITETAG[providerName.toLowerCase()] || providerName;
}

function isApiProvider(providerName) {
  return API_PROVIDERS.has(providerName.toLowerCase());
}

async function getStreamUrls(siteTag, html, pageUrl, rawResponse = false) {
  const hash = generateHash();
  if (!hash) return [];

  const body = JSON.stringify({
    payload: html,
    videoObject: { sourceLink: pageUrl, site: siteTag },
  });

  const gzipped = gzipSync(Buffer.from(body, 'utf-8'));

  try {
    const resp = await fetch(`${API_BASE}/sites/${siteTag}/stream?isTV=false`, {
      method: 'POST',
      headers: {
        'User-Agent': 'okhttp/5.3.2',
        Authorization: 'Bearer ',
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Encoding': 'gzip',
        hash,
      },
      body: gzipped,
    });

    if (!resp.ok) return [];
    const text = await resp.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }

    if (rawResponse) return parsed || {};

    if (!Array.isArray(parsed)) return [];

    return parsed.map(item => {
      const url = item.stream || item.streamLink || '';
      const qualityStr = item.quality || '';
      const quality = qualityStr.includes('2160') || qualityStr.includes('4k') ? 2160
        : qualityStr.includes('1080') ? 1080
        : qualityStr.includes('720') ? 720
        : qualityStr.includes('480') ? 480
        : qualityStr.includes('360') ? 360
        : 0;
      return { url, quality, isM3u8: url.includes('.m3u8') };
    }).filter(s => s.url);
  } catch {
    return [];
  }
}

export { getStreamUrls, getSiteTag, isApiProvider };
