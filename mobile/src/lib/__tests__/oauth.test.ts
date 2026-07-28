import { buildQueryString, parseQueryParams, randomOAuthState, randomPkceVerifier } from '@/lib/oauth';

describe('buildQueryString', () => {
  it('encodes keys and values', () => {
    expect(buildQueryString({ a: '1', b: 'hello world' })).toBe('a=1&b=hello%20world');
  });

  it('produces an empty string for no params', () => {
    expect(buildQueryString({})).toBe('');
  });
});

describe('parseQueryParams', () => {
  it('extracts params from a full redirect URL', () => {
    expect(parseQueryParams('toci://whoop/callback?code=abc123&state=xyz')).toEqual({ code: 'abc123', state: 'xyz' });
  });

  it('returns an empty object when there is no query string', () => {
    expect(parseQueryParams('toci://whoop/callback')).toEqual({});
  });

  it('decodes percent-encoded values', () => {
    expect(parseQueryParams('toci://spotify/callback?error=access%20denied')).toEqual({ error: 'access denied' });
  });

  it('ignores any URL fragment', () => {
    expect(parseQueryParams('toci://whoop/callback?code=abc#fragment')).toEqual({ code: 'abc' });
  });
});

describe('randomOAuthState / randomPkceVerifier', () => {
  it('produces strings of the requested length', () => {
    expect(randomOAuthState(16)).toHaveLength(16);
    expect(randomPkceVerifier(64)).toHaveLength(64);
  });

  it('is not the same value twice in a row', () => {
    expect(randomOAuthState(16)).not.toBe(randomOAuthState(16));
  });
});
