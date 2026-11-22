import { describe, expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createTown } from '../src/data/town';
import { villageAppearance } from '../src/services/publicVillage';
import TownBuildingDetails from '../src/components/town/TownBuildingDetails.vue';

// A shared town's building card shows what the building is and its level, never the owner's
// actions (build, upgrade, hammer, finish, mine, bell, era, museum, shop) or private state.
const card = (props) =>
  renderToString(createSSRApp({ render: () => h(TownBuildingDetails, props) }));
const ACTIONS =
  /town-primary|town-purchase|builder-hammer-action|town-detail-mine|town-project-mine/;

function sharedTown(buildings) {
  const empty = createTown();
  return villageAppearance({
    era: 'frontier',
    appearance: {
      era: 'frontier',
      buildings: { ...empty.buildings, ...buildings },
      buildingEras: empty.buildingEras,
      buildingEraLevels: empty.buildingEraLevels,
      projects: {},
      mineLevel: 12,
    },
  });
}

// The lifetime moonstones counter is the owner's: the public payload does not carry it, so a
// visitor's card would read 0 whatever the owner earned.
it('keeps the lifetime moonstones counter on the owner’s Homecoming Hall card only', async () => {
  const owner = { ...createTown(), era: 'twin-hollows', moonstonesEarned: 87 };
  owner.buildings.homecomingHall = 1;
  const { buildings, buildingEras, buildingEraLevels, era, personalisation } = owner;
  const shared = villageAppearance({
    era,
    appearance: { buildings, buildingEras, buildingEraLevels, era, personalisation },
  });
  const visitor = await card({ id: 'homecomingHall', town: shared, readOnly: true });
  expect(visitor).not.toContain('Lifetime moonstones earned');
  const own = await card({ id: 'homecomingHall', town: owner, hammers: 0 });
  expect(own).toContain('Lifetime moonstones earned: 87');
});

describe('shared-town building cards', () => {
  const town = sharedTown({ well: 1, farm: 1, home: 3, saloon: 3, blacksmith: 2, armory: 1 });

  it('shows the description and true level without any owner action', async () => {
    const html = await card({ id: 'saloon', town, readOnly: true });
    expect(html).toContain('Level 3 / 3');
    expect(html).toContain('coins/hour');
    expect(html).not.toMatch(ACTIONS);
    expect(html).not.toContain('Stored earnings');
  });

  it('describes the current level instead of offering the next upgrade', async () => {
    const owner = await card({ id: 'home', town: sharedTown({ home: 1 }), hammers: 1 });
    const visitor = await card({ id: 'home', town: sharedTown({ home: 1 }), readOnly: true });
    expect(owner).toMatch(ACTIONS);
    expect(visitor).not.toMatch(ACTIONS);
    expect(visitor).toContain('Level 1 / 3');
    expect(visitor).toContain('town-restored-note');
  });

  it('keeps the forge, the armory and empty plots free of private or purchase details', async () => {
    for (const id of ['blacksmith', 'armory', 'museum', 'shop']) {
      const html = await card({ id, town, readOnly: true, powers: [] });
      expect(html, id).not.toMatch(ACTIONS);
      expect(html, id).not.toMatch(/Forge Charge|armory-inventory|Collect again/);
    }
    const plot = await card({ id: 'museum', town, readOnly: true });
    expect(plot).toContain('Level 0 / 3');
    expect(plot).not.toContain('town-restored-note');
  });
});

// Phones show little of a long card: the owner's build, hammer and mining actions come right
// after the offer title, before the benefit and era description.
describe('owner building card actions', () => {
  const ownTown = (coins) => {
    const town = createTown();
    return { ...town, buildings: { ...town.buildings, well: 1, farm: 1, home: 1 }, coins };
  };
  const before = (html, first, second) => {
    expect(html.indexOf(first), first).toBeGreaterThan(-1);
    expect(html.indexOf(first), `${first} before ${second}`).toBeLessThan(html.indexOf(second));
  };

  it('puts the build and hammer actions above the offer text', async () => {
    const html = await card({ id: 'home', town: ownTown(1_000_000), hammers: 1 });
    before(html, 'town-purchase', 'town-offer-text');
    before(html, 'builder-hammer-action', 'town-offer-text');
    expect(html).not.toContain('town-detail-mine');
  });

  it('offers mining next to the unaffordable build, above the offer text', async () => {
    const html = await card({ id: 'home', town: ownTown(0), hammers: 0 });
    before(html, 'town-purchase', 'town-detail-mine');
    before(html, 'town-detail-mine', 'town-offer-text');
  });
});
