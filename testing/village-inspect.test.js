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

describe('shared-town building cards', () => {
  const town = sharedTown({ well: 1, farm: 1, home: 3, saloon: 5, blacksmith: 2, armory: 1 });

  it('shows the description and true level without any owner action', async () => {
    const html = await card({ id: 'saloon', town, readOnly: true });
    expect(html).toContain('Level 5 / 5');
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
