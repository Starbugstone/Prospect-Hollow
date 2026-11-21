import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import { ERAS, ERA_BY_ID } from '../src/data/eras';
import { createTown } from '../src/data/town';
import {
  AREA_BY_ID,
  PERSONAL_AREAS,
  areaUnlocked,
  nextAreaToOpen,
} from '../src/data/townLandmarks';
import { useCampaignStore } from '../src/stores/campaignStore';
import { find, renderFragment, sfc } from './helpers/componentFragments';
import { openEverySite } from './helpers/siteOpening';

// The Build tab's "Next monument site" names the locked site that opens soonest, in era
// order, whatever order the catalogue declares its sites in.
const VIEW = 'src/components/town/TownView.vue';
const hint = find(sfc(VIEW).template.ast, (node) =>
  node.props?.some((prop) => prop.name === 'if' && prop.exp?.content === 'nextMonumentSite'),
).loc.source;
const eraIndex = (id) => ERAS.findIndex((era) => era.id === id);

let pinia;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

// A town in `era` whose sites of that era and earlier are all open.
const townIn = (era) =>
  openEverySite(
    { ...createTown(), era, tourSeen: true },
    PERSONAL_AREAS.filter((area) => eraIndex(area.era) <= eraIndex(era)),
  );

it('names Hollowborn Square, a full era before Voyagers’ Court, once Twin Hollows is open', async () => {
  const town = townIn('twin-hollows');
  // The catalogue declares Voyagers' Court first, though it opens an era later.
  const locked = PERSONAL_AREAS.filter((area) => !areaUnlocked(town, area)).map(({ id }) => id);
  expect(locked.indexOf('voyagers-court')).toBeLessThan(locked.indexOf('hollowborn-square'));
  useCampaignStore().town = town;
  const html = await renderFragment({ component: TownView, path: VIEW, template: hint, pinia });
  expect(html).toContain(AREA_BY_ID['hollowborn-square'].label);
  expect(html).toContain(ERA_BY_ID['hollow-rising'].label);
  expect(html).not.toContain(AREA_BY_ID['voyagers-court'].label);
});

it('always names a locked site of the earliest era still to open', () => {
  for (const { id: era } of ERAS) {
    for (const town of [townIn(era), { ...createTown(), era }]) {
      const locked = PERSONAL_AREAS.filter((area) => !areaUnlocked(town, area));
      const next = nextAreaToOpen(town);
      if (!locked.length) {
        expect(next).toBeNull();
        continue;
      }
      expect(locked).toContain(next);
      const soonest = Math.min(...locked.map((area) => eraIndex(area.era)));
      expect(eraIndex(next.era), `${era}: ${next.id}`).toBe(soonest);
      // Within that era, a site that opens with the era comes before one that waits.
      if (next.opens)
        expect(locked.filter((area) => eraIndex(area.era) === soonest && !area.opens)).toEqual([]);
    }
  }
});

it('names nothing once every site is open', () => {
  const last = ERAS.findLast((era) => era.enabled).id;
  const town = openEverySite({ ...createTown(), era: last }, PERSONAL_AREAS);
  expect(nextAreaToOpen(town)).toBeNull();
});
