import { describe, expect, it } from 'vitest';
import { cardSummary, profileSummary } from '../src/services/townSummary';

describe('Account town card summaries', () => {
  const server = { summary: { era: 'industrial', coins: 900, buildings: 6 } };
  const offline = {
    town: { era: 'frontier', coins: 1000, buildings: { well: 2, farm: 1, home: 0 } },
  };
  it('fills a new device card without a cached save', () => {
    expect(cardSummary(server)).toEqual(server.summary);
  });
  it('shows active offline progress, and server summaries for other towns', () => {
    expect(cardSummary(server, { activeProfile: offline })).toEqual({
      era: 'frontier',
      coins: 1000,
      buildings: 2,
    });
    expect(cardSummary(server, { cachedProfile: offline })).toEqual(server.summary);
  });
  it('supports an older server without fabricating a playable save', () => {
    expect(cardSummary({}, { cachedProfile: offline })).toEqual(profileSummary(offline));
    expect(cardSummary({})).toBeNull();
  });
  it('handles future eras and malformed numeric values defensively', () => {
    expect(
      cardSummary({ summary: { era: 'future-era', coins: -1, buildings: 'invalid' } }),
    ).toEqual({ era: 'future-era', coins: 0, buildings: 0 });
    expect(
      profileSummary({ town: { coins: Infinity, buildings: { a: '1', b: 1, c: null, d: -1 } } }),
    ).toEqual({ era: '', coins: 0, buildings: 1 });
  });
});
