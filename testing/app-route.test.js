import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let activeMeta = null;
vi.mock('../src/services/townStorage', () => ({
  townStorage: {
    active: () => (activeMeta ? { meta: activeMeta } : null),
    activeMeta: () => activeMeta ?? null,
  },
}));
const {
  isPlayRoute,
  isVisitRoute,
  visitId,
  visitUrl,
  navigate,
  syncTownParam,
  upgradeLegacyLink,
  townUrl,
} = await import('../src/services/appRoute');

// A minimal browser address bar: history entries update location in place.
function browser(href) {
  const entries = [];
  const location = new URL(href);
  const move = (url) => {
    location.href = new URL(url, location.href).href;
  };
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', {
    state: null,
    pushState: (state, title, url) => {
      entries.push(location.href);
      move(url);
    },
    replaceState: (state, title, url) => move(url),
  });
  return { location, entries };
}

beforeEach(() => {
  activeMeta = null;
});
afterEach(() => vi.unstubAllGlobals());

describe('Home page and game addresses', () => {
  it('keeps the home page at the root and the game at /play across reloads', () => {
    browser('https://hollow.test/');
    expect(isPlayRoute()).toBe(false);
    browser('https://hollow.test/play');
    expect(isPlayRoute()).toBe(true);
    browser('https://hollow.test/play/?play=abc');
    expect(isPlayRoute()).toBe(true);
    browser('https://hollow.test/playground');
    expect(isPlayRoute()).toBe(false);
  });

  it('pushes a history entry between home and game so back returns home', () => {
    const { location, entries } = browser('https://hollow.test/#login=token');
    navigate(true);
    expect(location.pathname).toBe('/play');
    expect(location.hash).toBe('');
    expect(entries).toEqual(['https://hollow.test/#login=token']);
    navigate(true);
    expect(entries).toHaveLength(1);
    navigate(false);
    expect(location.href).toBe('https://hollow.test/');
  });

  it('names the open cloud town only on the game address', () => {
    activeMeta = { id: 'town-1', owner: 'account-1' };
    const { location } = browser('https://hollow.test/');
    syncTownParam();
    expect(location.search).toBe('');
    navigate(true);
    expect(location.href).toBe('https://hollow.test/play?play=town-1');
    navigate(false);
    expect(location.search).toBe('');

    activeMeta = { id: 'local-town' };
    const local = browser('https://hollow.test/play?play=town-1').location;
    syncTownParam();
    expect(local.href).toBe('https://hollow.test/play');
  });

  it('sends links made before the game had its own address to the game', () => {
    const { location } = browser('https://hollow.test/?play=town-2');
    upgradeLegacyLink();
    expect(location.href).toBe('https://hollow.test/play?play=town-2');
    browser('https://hollow.test/');
    upgradeLegacyLink();
    expect(isPlayRoute()).toBe(false);
    expect(townUrl('a b')).toBe('https://hollow.test/play?play=a%20b');
  });
});

describe('Shared town links', () => {
  const id = '8202b62f62f3b5d5e16125f7f43efff3';

  it('shares a view-only address, never the game, from whichever page made it', () => {
    for (const page of ['https://hollow.test/play?play=town-1', 'https://hollow.test/']) {
      browser(page);
      const link = new URL(visitUrl(id, {}));
      expect(link.href).toBe(`https://hollow.test/visit#town=${id}`);
      expect(isPlayRoute(link)).toBe(false);
      expect(isVisitRoute(link)).toBe(true);
      expect(link.searchParams.has('play')).toBe(false);
      expect(visitId(link)).toBe(id);
    }
    expect(visitUrl(id, { VITE_PUBLIC_ORIGIN: 'https://hollow.example/' })).toBe(
      `https://hollow.example/visit#town=${id}`,
    );
    expect(visitUrl(id, { VITE_API_BASE: 'https://api.hollow.example/api/v1' })).toBe(
      `https://api.hollow.example/visit#town=${id}`,
    );
  });

  it('moves old shared links off the game address and drops any town to play', () => {
    for (const old of [
      `https://hollow.test/play#town=${id}`,
      `https://hollow.test/#town=${id}`,
      `https://hollow.test/play?play=town-2#town=${id}`,
    ]) {
      const { location } = browser(old);
      upgradeLegacyLink();
      expect(location.href).toBe(`https://hollow.test/visit#town=${id}`);
      expect(isPlayRoute()).toBe(false);
    }
  });

  it('keeps the visit address apart from the game and home page', () => {
    const { location } = browser(`https://hollow.test/visit/#town=${id}`);
    upgradeLegacyLink();
    expect(location.href).toBe(`https://hollow.test/visit/#town=${id}`);
    expect(isVisitRoute()).toBe(true);
    expect(isPlayRoute()).toBe(false);
    browser('https://hollow.test/visitors');
    expect(isVisitRoute()).toBe(false);
    browser('https://hollow.test/play');
    expect(visitId()).toBe('');
  });
});
