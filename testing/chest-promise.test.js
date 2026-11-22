import { afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import HudPanel from '../src/components/HudPanel.vue';
import MineScoreMeter from '../src/components/MineScoreMeter.vue';
import ObstacleGuide from '../src/components/ObstacleGuide.vue';
import { runChests } from '../src/data/campaign';
import { latestUpdates } from '../src/data/updates';
import { setLocale } from '../src/i18n';
import fr from '../src/i18n/fr.json';
import { useGameStore } from '../src/stores/gameStore';

// A finished run earns one chest, or two when it meets both the score and the time
// target (runChests). Every place that explains chests says exactly that.
const PROMISE = 'Finish for one chest. Meet both the score and time targets for two.';

afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
});

it('gives one chest for finishing and a second only for both targets', () => {
  const count = (score, elapsed) => runChests(score, 1000, elapsed, 60000).length;
  expect(count(0, 90000)).toBe(1);
  expect(count(1000, 90000)).toBe(1);
  expect(count(0, 30000)).toBe(1);
  expect(count(1000, 30000)).toBe(2);
});

async function render(component, props = {}) {
  // The guide is a native dialog; server rendering only reads the focused element.
  vi.stubGlobal('document', { activeElement: null });
  const pinia = createPinia();
  setActivePinia(pinia);
  const game = useGameStore();
  Object.assign(game, {
    playMode: 'normal',
    score: 0,
    elapsedMs: 0,
    speedTargetMs: 120000,
    starScoreTarget: 5000,
    objectives: [{ type: 'score', target: 4000 }],
  });
  return renderToString(createSSRApp({ render: () => h(component, props) }).use(pinia));
}

it.each([
  ['HudPanel', HudPanel],
  ['ObstacleGuide', ObstacleGuide],
  ['MineScoreMeter', MineScoreMeter],
])('%s promises one chest, or two for both targets', async (_, component) => {
  const html = await render(component, { obstacles: [] });
  expect(html).toContain(PROMISE);
  expect(html).not.toMatch(/bonus chest|extra chests|other chests/i);
  setLocale('fr');
  expect(await render(component, { obstacles: [] })).toContain(fr[PROMISE]);
});

it('says the same in the live-score update note', () => {
  const note = latestUpdates(Infinity).find(({ title }) => title === 'Live score in the mine');
  expect(note.text).toContain(PROMISE);
  expect(fr[note.text]).toContain(fr[PROMISE]);
});
