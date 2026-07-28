// Client-side halves of the Authorization Code (+ PKCE for Spotify) flows the
// backend already implements (toci/whoop.py, toci/spotify.py) and the web
// frontend already drives (web/app.js) -- same scopes, same PKCE mechanics,
// just a native redirect instead of a same-origin one. No URL/URLSearchParams
// globals used here since RN doesn't polyfill them by default.
import * as Crypto from 'expo-crypto';

const VERIFIER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const STATE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomStringFromCharset(length: number, charset: string): string {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join('');
}

export function randomPkceVerifier(length = 64): string {
  return randomStringFromCharset(length, VERIFIER_CHARS);
}

export function randomOAuthState(length = 16): string {
  return randomStringFromCharset(length, STATE_CHARS);
}

export async function pkceCodeChallenge(verifier: string): Promise<string> {
  const digestBase64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return digestBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function parseQueryParams(url: string): Record<string, string> {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return {};
  const query = url.slice(queryIndex + 1).split('#')[0];
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [key, rawValue = ''] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
  }
  return params;
}
