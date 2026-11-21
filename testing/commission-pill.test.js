import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import { commissionStatus } from '../src/data/commissions';
import { createTown } from '../src/data/town';
import { areasForSettlement } from '../src/data/townLandmarks';
import { useCampaignStore } from '../src/stores/campaignStore';
import { find, renderFragment, sfc } from './helpers/componentFragments';
import { openEverySite } from './helpers/siteOpening';

// The map's "New commission" pill steps aside while an era cinematic or a presentation
// (a milestone, a monument unveiling) plays over the map, and comes back afterwards.
const VIEW = 'src/components/town/TownView.vue';
const foot = find(sfc(VIEW).template.ast, (node) =>
  node.props?.some((prop) => prop.name === 'class' && prop.value?.content === 'town-map-foot'),
).loc.source;

let pinia;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

// A Quiet Signal town whose commission sites are open and waiting for a design.
function commissionTown(changes = {}) {
  const town = openEverySite(
    { ...createTown(), era: 'quiet-signal', tourSeen: true },
    areasForSettlement('moon'),
  );
  expect(commissionStatus(town)[0]?.state).toBe('request');
  return { ...town, ...changes };
}
async function pillShown(town) {
  useCampaignStore().town = town;
  const html = await renderFragment({
    component: TownView,
    path: VIEW,
    template: foot,
    props: { active: true },
    pinia,
  });
  return html.includes('town-commission-goal');
}
const transition = (pending) => ({
  id: 'hollow-rising:quiet-signal',
  from: 'hollow-rising',
  to: 'quiet-signal',
  pending,
});

it('shows the commission pill on the map when nothing plays over it', async () => {
  expect(await pillShown(commissionTown())).toBe(true);
  expect(await pillShown(commissionTown({ transition: transition(false) }))).toBe(true);
});

it('hides the pill during an era cinematic', async () => {
  expect(await pillShown(commissionTown({ transition: transition(true) }))).toBe(false);
});

it('hides the pill during a presentation', async () => {
  const town = commissionTown({ presentations: { 'three-star-celebration': 'pending' } });
  expect(await pillShown(town)).toBe(false);
  expect(await pillShown({ ...town, presentations: { 'three-star-celebration': 'seen' } })).toBe(
    true,
  );
});
