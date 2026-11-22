import { expect, it } from 'vitest';
import { latestUpdates } from '../src/data/updates';
import fr from '../src/i18n/fr.json';

// The 2D valley map is retired, so no update note may promise anything on it.
it('advertises nothing on the retired 2D valley map', () => {
  for (const { title, text } of latestUpdates(Infinity)) {
    expect(text, title).not.toMatch(/\b2D\b/i);
    expect(fr[text], title).not.toMatch(/\b2D\b/i);
  }
});
