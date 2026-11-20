import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TownBuilding from '../src/components/town/TownBuilding.vue';
import { Box3, Group, MeshBasicMaterial } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { defineEra } from '../src/data/eraDefinitions';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { CITY_FAMILIES } from '../src/data/city';
import buildingStyles from '../src/data/cityBuildingStyles.json';
import { BUILDING_BY_ID, createTown } from '../src/data/town';
import { plotInEra } from '../src/game/town/TownEras';
import {
  OWN_ROOF_COLOURS,
  ROOF_ROLES,
  ROOF_STYLES,
  plotShade,
  plotVariant,
  roofPaint,
  roofRole,
  roofStyle,
  roofTone,
  shade,
} from '../src/data/roofTones';

beforeAll(() => loadFamilies(ALL_MESH_FAMILIES));

function plot(era, id) {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.contactShadowMaterial = new MeshBasicMaterial();
  d.sign = vi.fn();
  const town = createTown(),
    root = new Group();
  d.town = town;
  town.era = era;
  town.buildings[id] = BUILDING_BY_ID[id].upgrades.length;
  town.buildingEras[id] = era;
  town.buildingEraLevels[id] = era === 'frontier' ? 0 : 3;
  d.buildPlot(id, root, town, { [id]: id });
  const colours = new Set();
  let triangles = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.material?.color) return;
    colours.add(`#${mesh.material.color.getHexString()}`);
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
  });
  return { root, colours, triangles, bounds: new Box3().setFromObject(root) };
}

describe('Roof tones by purpose', () => {
  it('gives every era a roof style or a recorded reason to keep its own colours', () => {
    for (const era of ERAS.filter((entry) => entry.enabled)) {
      const profile = era.evolution;
      if (OWN_ROOF_COLOURS.includes(profile.architecture)) expect(roofStyle(profile)).toBeNull();
      else expect(roofStyle(profile), era.id).not.toBeNull();
    }
  });

  it('defines distinct tones for every role of every style', () => {
    for (const [style, tones] of Object.entries(ROOF_STYLES)) {
      expect(tones.from.length, style).toBeGreaterThan(0);
      const roles = ROOF_ROLES.map((role) => tones[role]);
      for (const tone of roles) expect(tone, style).toMatch(/^#[0-9a-f]{6}$/);
      expect(new Set(roles).size, style).toBe(ROOF_ROLES.length);
      // Homes keep the roof the era's renderer draws.
      expect(tones.from).toContain(tones.home);
    }
  });

  it('assigns a role to every building family with a roofed shell', () => {
    for (const [kind, { family }] of Object.entries(buildingStyles)) {
      expect(roofRole(kind), `${kind} (${family})`).not.toBeNull();
      expect(CITY_FAMILIES[kind]).toBe(family);
    }
    for (const kind of ['square', 'bridge', 'park', 'airport', 'no-such-kind', 'constructor'])
      expect(roofRole(kind)).toBeNull();
  });

  it('inherits tones with an architecture and leaves an unknown style alone', () => {
    const base = eraEvolution('moonward');
    ERA_BY_ID['homestead-successor'] = defineEra({
      id: 'homestead-successor',
      evolution: { ...base },
    });
    expect(roofTone(eraEvolution('homestead-successor'), 'bank', 'bank')).toEqual(
      roofTone(base, 'bank', 'bank'),
    );
    delete ERA_BY_ID['homestead-successor'];
    expect(roofTone({ style: 'city', cityAssets: 'unknown' }, 'bank', 'bank')).toBeNull();
    expect(roofTone({ architecture: 'constructor' }, 'bank', 'bank')).toBeNull();
    expect(roofTone(null, 'bank', 'bank')).toBeNull();
    expect(roofTone(base, 'square', 'square')).toBeNull();
  });

  it('tells plots of one kind apart by a shade and keeps colours valid', () => {
    expect(plotShade('home', 'home')).toBe(0);
    expect(plotShade('home2', 'home')).not.toBe(plotShade('home3', 'home'));
    const profile = eraEvolution('industrial');
    expect(roofTone(profile, 'home2', 'home').to).not.toBe(roofTone(profile, 'home', 'home').to);
    expect(shade('#808080', 0)).toBe('#808080');
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', -1)).toBe('#000000');
  });

  it.each([
    'frontier',
    'river-rail',
    'industrial',
    'aviation',
    'tomorrow',
    'riverlight',
    'moonward',
  ])('repaints only the roof of %s buildings, by purpose', (era) => {
    const profile = eraEvolution(era),
      style = ROOF_STYLES[roofStyle(profile)];
    const town = { ...createTown(), era };
    const seen = new Set();
    for (const id of ['home', 'bank', 'shop', 'armory']) {
      if (!plotInEra(town, id)) continue;
      const built = plot(era, id),
        tone = built.root.userData.roofTone;
      expect(tone).toEqual(roofTone(profile, id, BUILDING_BY_ID[id].kind));
      expect(built.colours.has(tone.to), `${era} ${id}`).toBe(true);
      // Nothing of the drawn roof colour is left on a building with another tone.
      for (const from of style.from)
        if (from !== tone.to) expect(built.colours.has(from), `${era} ${id}`).toBe(false);
      seen.add(tone.to);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it('changes no geometry: a plot keeps its triangles and bounds whatever its tone', () => {
    const bank = plot('industrial', 'bank');
    const original = ROOF_STYLES.industrial.civic;
    ROOF_STYLES.industrial.civic = '#123456';
    try {
      const repainted = plot('industrial', 'bank');
      expect(repainted.colours.has('#123456')).toBe(true);
      expect(repainted.triangles).toBe(bank.triangles);
      expect(repainted.bounds.min.toArray()).toEqual(bank.bounds.min.toArray());
      expect(repainted.bounds.max.toArray()).toEqual(bank.bounds.max.toArray());
    } finally {
      ROOF_STYLES.industrial.civic = original;
    }
  });
});

describe('Plots of one kind', () => {
  const blocks = (root) => {
    let count = 0;
    root.traverse((part) => {
      if (part.name === 'Future building block') count++;
    });
    return count;
  };
  const HOMES = ['home', 'home2', 'home3', 'home4', 'home5'];
  const homeWith = (variant) => HOMES.find((id) => plotVariant(id, 'home') === variant);
  it('numbers the plots of a kind and starts unknown ones at zero', () => {
    expect(plotVariant('home', 'home')).toBe(0);
    expect(HOMES.map((id) => plotVariant(id, 'home')).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(['farm', 'farm2', 'farm3'].map((id) => plotVariant(id, 'farm'))).size).toBe(3);
    expect(plotVariant('no-such-plot', 'home')).toBe(0);
    expect(plotVariant('bank', 'no-such-kind')).toBe(0);
  });

  it('gives each frontier home its own touch above an unchanged cabin', () => {
    const frontierHomes = HOMES.filter((id) => BUILDING_BY_ID[id].introducedEra === 'frontier');
    const built = frontierHomes.map((id) => plot('frontier', id));
    const first = built[frontierHomes.indexOf('home')];
    expect(first.root.getObjectByName('Home cupola')).toBeUndefined();
    expect(new Set(built.map((home) => home.triangles)).size).toBe(built.length);
    // The touches sit on the roof: the ground plan of every home is the same.
    for (const other of built)
      for (const axis of ['x', 'z']) {
        expect(other.bounds.min[axis]).toBeCloseTo(first.bounds.min[axis], 2);
        expect(other.bounds.max[axis]).toBeCloseTo(first.bounds.max[axis], 2);
      }
  });

  it('gives each future home its own massing inside the first home\u2019s width', () => {
    const first = plot('moonward', 'home');
    expect(blocks(first.root)).toBe(1);
    const shapes = new Set([first.triangles]);
    for (const id of HOMES.filter((home) => home !== 'home')) {
      const other = plot('moonward', id);
      shapes.add(other.triangles);
      expect(other.bounds.min.x).toBeGreaterThanOrEqual(first.bounds.min.x - 0.05);
      expect(other.bounds.max.x).toBeLessThanOrEqual(first.bounds.max.x + 0.05);
    }
    expect(blocks(plot('moonward', homeWith(1)).root)).toBe(2);
    expect(shapes.size).toBeGreaterThan(2);
    // Other kinds keep their one authored form on every plot.
    expect(plot('moonward', 'farm2').triangles).toBe(plot('moonward', 'farm').triangles);
  });

  // Tomorrow's domes, the garden cottages and the 1920–2005 shells: one family, five homes.
  it.each(['post-war', 'motor-age', 'aviation', 'broadcast', 'contemporary', 'tomorrow', 'canopy'])(
    'tells the %s homes apart and leaves the first as authored',
    (era) => {
      const built = HOMES.map((id) => plot(era, id));
      // Its own shape: a different part count or a different outline.
      const shape = ({ triangles, bounds }) =>
        [triangles, ...bounds.min.toArray(), ...bounds.max.toArray()]
          .map((n) => n.toFixed(1))
          .join(' ');
      expect(new Set(built.map(shape)).size, era).toBe(HOMES.length);
      const first = built[HOMES.indexOf('home')];
      expect(first.root.getObjectByName('Home character')).toBeUndefined();
      // A home's own touch stays small beside the house.
      for (const home of built) expect(home.triangles).toBeLessThan(first.triangles + 1500);
    },
  );
});

describe('The 2D drawings wear the same roof tones', () => {
  const drawing = (era, id) =>
    renderToString(
      createSSRApp({
        render: () => h('svg', [h(TownBuilding, { id, era, stage: 3, eraLevel: 3 })]),
      }),
    );
  // Frontier shops and the bank have a false front and no drawn roof; the gabled school does.
  it('paints the frontier school in its civic tone', async () => {
    const tone = roofTone(eraEvolution('frontier'), 'school', 'school');
    expect(tone.role).toBe('civic');
    expect(await drawing('frontier', 'school')).toContain(tone.to);
    expect(await drawing('frontier', 'farm')).not.toContain(tone.to);
  });

  // One era per family of drawings: period shells, garden and future kits.
  it.each(['aviation', 'canopy', 'moonward'])(
    'paints the %s bank and trading post in the tones of the 3D town',
    async (era) => {
      const profile = eraEvolution(era);
      for (const id of ['bank', 'shop']) {
        const tone = roofTone(profile, id, BUILDING_BY_ID[id].kind);
        expect(await drawing(era, id), `${era} ${id}`).toContain(tone.to);
      }
      const bank = roofTone(profile, 'bank', 'bank').to,
        shop = roofTone(profile, 'shop', 'shop').to;
      expect(bank).not.toBe(shop);
      expect(await drawing(era, 'shop')).not.toContain(bank);
    },
  );

  it('keeps the drawn roof where the era or the kind has no tone', async () => {
    expect(roofPaint(eraEvolution('skysail'), 'bank', 'bank', '#abcdef')).toBe('#abcdef');
    expect(roofPaint(eraEvolution('aviation'), 'airport', 'airport', '#abcdef')).toBe('#abcdef');
    expect(roofPaint(null, 'bank', 'bank', '#abcdef')).toBe('#abcdef');
    // A card with no plot uses the kind's first plot: no shade.
    expect(roofPaint(eraEvolution('aviation'), undefined, 'bank', '#abcdef')).toBe(
      ROOF_STYLES.aviation.civic,
    );
    expect(await drawing('frontier', 'home')).toContain('#869b90');
  });
});
