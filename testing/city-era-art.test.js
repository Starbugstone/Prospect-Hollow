import { afterEach, expect, it } from 'vitest';
import { cityAppearance } from '../src/data/cityAppearance';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { CITY_FAMILIES } from '../src/data/city';
import { resolveCityAsset } from '../src/data/eraDefinitions';
import assets from '../src/assets/city-meshes.json';

afterEach(() => {
  delete ERA_BY_ID['future-city'];
});

it('gives every shared city building its own period architecture and complete upgrade pieces', () => {
  const families = [...new Set(Object.values(CITY_FAMILIES))].filter(
    (family) =>
      !['airport', 'radio', 'concert', 'television', 'skyline', 'square', 'park', 'field'].includes(
        family,
      ),
  );
  for (const family of [...families, 'wing', 'finish', 'garden', 'mine']) {
    const shapes = new Set();
    for (const era of ['post-war', 'aviation', 'broadcast', 'contemporary']) {
      const asset = resolveCityAsset(`${era}-${family}`, ERAS);
      const parts = assets.models[asset];
      expect(parts?.length, asset).toBeGreaterThan(0);
      expect(
        parts.every((part) => part.positions.every(Number.isFinite)),
        asset,
      ).toBe(true);
      shapes.add(JSON.stringify(parts.map(({ positions, color }) => [positions, color])));
    }
    expect(shapes.size, family).toBe(4);
  }
});

it('reserves solar panels, electric roof packs and planted roofs for the connected city', () => {
  for (const era of ['post-war', 'aviation', 'broadcast']) {
    expect(cityAppearance(era)).toMatchObject({
      solar: false,
      roofGarden: false,
      electricVehicles: false,
      timberFins: false,
    });
    // Solar material is unique to panel geometry in this asset pack; assert the export as well as its profile.
    const parts = Object.entries(assets.models)
      .filter(([name]) => name.startsWith(`${era}-`))
      .flatMap(([, parts]) => parts);
    expect(
      parts.some((part) => part.color === '#526f79'),
      era,
    ).toBe(false);
  }
  expect(cityAppearance('aviation').streamlined).toBe(true);
  expect(cityAppearance('broadcast').modern).toBe(true);
  expect(cityAppearance('contemporary')).toMatchObject({
    solar: true,
    roofGarden: true,
    electricVehicles: true,
    timberFins: true,
  });
  expect(assets.models['contemporary-depot'].some((part) => part.color === '#526f79')).toBe(true);
});

it('inherits city art through the era contract and handles unsupported or incomplete profiles', () => {
  ERA_BY_ID['future-city'] = { evolution: { ...eraEvolution('broadcast') } };
  expect(cityAppearance('future-city')).toBe(cityAppearance('broadcast'));
  for (const cityAssets of [undefined, null, 'missing', '__proto__', 'constructor']) {
    ERA_BY_ID['future-city'] = { evolution: { ...eraEvolution('broadcast'), cityAssets } };
    expect(cityAppearance('future-city')).toBe(cityAppearance('post-war'));
  }
  expect(cityAppearance('constructor')).toBe(cityAppearance('post-war'));
});
