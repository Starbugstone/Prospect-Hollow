import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Box3, Group } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { BUILDINGS, BUILDING_BY_ID, createTown } from '../src/data/town';
import { NEED_SOURCES } from '../src/data/townNeeds';
import {
  MOON_DISTRICTS,
  MOON_LOTS,
  MOON_RIM_RADIUS,
  MOON_ROADS,
  moonApproaches,
  moonDistrictAt,
  moonDistrictsShown,
  moonLotDistrict,
  moonLotPose,
  moonLotsShown,
  moonOnLevelGround,
  moonPadApothem,
  moonPadRadius,
  moonSegmentDistance,
} from '../src/data/moonSettlement';
import {
  QUIET_STONE,
  SIGNAL_STAGES,
  quietStoneLabel,
  signalAnswered,
  signalLetters,
  signalStage,
  starMap,
} from '../src/data/quietSignal';
import { AREA_BY_ID, LANDMARK_BY_ID, areaUnlocked, landmarkPrice } from '../src/data/townLandmarks';
import { moonModernization } from '../src/data/moonModernizations';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { renderMoonBuilding } from '../src/game/town/buildings/moon';
import { MOON_FINISH_KINDS } from '../src/game/town/buildings/moonFinishes';
import { SIGNAL_FORMS, SIGNAL_PULSE, signalPulse } from '../src/game/town/buildings/moonSignal';
import { buildLandmark } from '../src/game/town/TownLandmarks';
import { SIGNAL_LANDMARK_FORMS } from '../src/game/town/moon/MoonSignalLandmarks';
import { districtRoads, quietStone } from '../src/game/town/moon/MoonDistricts';
import { moonMapBox, moonMapLabel, moonMapPoint } from '../src/game/town/moon/MoonLabelLayout';
import { moonLabelAnchors } from '../src/game/town/moon/MoonMonuments';
import { moonHeight } from '../src/game/town/moon/MoonScene';
import {
  createMoonSettlers,
  moonSettlerPlan,
  moonSettlerPose,
  moonSettlerRoute,
} from '../src/game/town/moon/MoonSettlers';
import { moonSaucerFlightPoint } from '../src/game/town/moon/MoonSaucer';
import { Vector3 } from 'three';
import { SIGNAL_DRAWINGS, moonFinishDrawing } from '../src/components/town/moonSignalDrawings';
import TownMoonBuilding from '../src/components/town/TownMoonBuilding.vue';
import TownLandmarkPreview from '../src/components/town/TownLandmarkPreview.vue';

// The Quiet Signal: the Far Rim district beyond the crater rim, the Quiet Stone at its
// centre, and the story read from what the town builds there.
const ERA = 'quiet-signal';
const FAR_RIM = MOON_DISTRICTS.farRim;
const KINDS = Object.keys(SIGNAL_FORMS);
const SIGNAL_BUILDINGS = BUILDINGS.filter((building) => building.introducedEra === ERA);
const REQUIRED = SIGNAL_BUILDINGS.filter((building) => building.requiredForEraCompletion);
const farLots = Object.entries(MOON_LOTS).filter(([id]) => moonLotDistrict(id));
const craterLots = Object.keys(MOON_LOTS).filter((id) => !moonLotDistrict(id));
// A town that has reached the era, whether or not the era is open to players yet.
const signalTown = (levels = {}) => ({
  ...createTown(),
  era: ERA,
  buildings: { ...createTown().buildings, spaceElevator: 3, ...levels },
});
const beyondPad = (x, z, radius) =>
  Math.max(
    Math.abs(x) * Math.sin(Math.PI / 8) + Math.abs(z) * Math.cos(Math.PI / 8),
    Math.abs(z) * Math.sin(Math.PI / 8) + Math.abs(x) * Math.cos(Math.PI / 8),
  ) - moonPadApothem(radius);
const svg = (component, props) =>
  renderToString(createSSRApp({ render: () => h('svg', [h(component, props)]) }));
const round = (value) => Math.round(value * 1e6) / 1e6;

describe('The Quiet Signal: the era', () => {
  it('follows New Hollow Rising on the price ladder and builds only on the Moon', () => {
    const at = ERAS.findIndex((era) => era.id === ERA);
    expect(ERAS[at - 1].id).toBe('hollow-rising');
    const [era, before] = [eraEvolution(ERA), eraEvolution('hollow-rising')];
    expect(era.prices).toEqual(before.prices.map((price) => price + 1600));
    expect(era.newBuildingPrices).toEqual(before.newBuildingPrices.map((price) => price + 2250));
    expect(era.modernizes).toEqual(['square', 'starwatchDish']);
    expect(SIGNAL_BUILDINGS.map(({ id }) => id).sort()).toEqual([...KINDS].sort());
    for (const building of SIGNAL_BUILDINGS) {
      expect(building.settlement, building.id).toBe('moon');
      expect(moonLotDistrict(building.id), building.id).toBe(FAR_RIM);
    }
    expect(REQUIRED).toHaveLength(6);
    expect(BUILDING_BY_ID.patternGarden.requiredForEraCompletion).toBe(false);
    const steps = moonModernization(ERA, 'starwatchDish').steps;
    expect(steps).toHaveLength(3);
    expect(MOON_FINISH_KINDS[ERA]).toEqual(['starwatchDish']);
  });

  it('carries its own residents and visitors: water, food and comfort for all of them', () => {
    const total = (stat) =>
      REQUIRED.reduce((sum, { effects }) => sum + (effects[stat] ?? 0) * 3, 0);
    const demand = total('housing') + total('visitors');
    expect(demand).toBe(42);
    expect(total('water')).toBe(demand);
    expect(total('food')).toBe(demand);
    expect(total('comfort')).toBeGreaterThanOrEqual(demand * 0.6);
    // The era adds no supply tier of its own, so nothing else hides a shortfall.
    for (const { eraTiers } of NEED_SOURCES.filter((source) => source.id?.startsWith('crater')))
      expect(Object.hasOwn(ERAS.find((era) => era.id === ERA).evolution, eraTiers)).toBe(false);
  });

  it('never gates anything on the stone, the optional garden or the monument site', () => {
    expect(BUILDING_BY_ID[QUIET_STONE.id]).toBeUndefined();
    expect(MOON_LOTS[QUIET_STONE.id]).toBeUndefined();
    expect(AREA_BY_ID[QUIET_STONE.id]).toBeUndefined();
    for (const building of BUILDINGS)
      for (const { id } of building.unlock ?? []) expect(id).not.toBe('patternGarden');
    const court = AREA_BY_ID['voyagers-court'];
    expect(court.settlement).toBe('moon');
    expect(areaUnlocked(signalTown(), court)).toBe(true);
    expect(areaUnlocked({ ...signalTown(), era: 'hollow-rising' }, court)).toBe(false);
    expect(court.choices.map((choice) => landmarkPrice(court, choice, 1))).toEqual([
      37000, 38000, 39000,
    ]);
  });
});

describe('The Far Rim: new ground, opened by the era', () => {
  it('leaves the crater, its lots, paths, settlers and saucer line exactly as they were', () => {
    const levels = Object.fromEntries(craterLots.map((id) => [id, 3]));
    const heights = [];
    for (let x = -260; x <= 260; x += 13)
      for (let z = -260; z <= 260; z += 13) heights.push(round(moonHeight(x, z)));
    const snapshot = JSON.parse(
      JSON.stringify({
        lots: craterLots.map((id) => [id, MOON_LOTS[id], moonLotPose(id), moonPadRadius(id)]),
        paths: moonApproaches(levels).map((route) => [
          route.id,
          route.ring,
          route.points.map((point) => point.map(round)),
        ]),
        heights,
        settlers: Array.from({ length: 14 }, (_, n) => {
          const plan = moonSettlerPlan(levels, n);
          return [
            plan.home,
            round(plan.duration),
            [0, 17, 61, 133, 301].map((time) => {
              const pose = moonSettlerPose(plan, time);
              return [round(pose.x), round(pose.z), pose.inside];
            }),
          ];
        }),
        saucer: [0, 6, 10, 14, 18, 82, 88, 92].map((phase) =>
          moonSaucerFlightPoint(phase, true, new Vector3()).toArray().map(round),
        ),
      }),
    );
    // Recorded from the Moon as it stood before the district was added (New Hollow
    // Rising). Set WRITE_MOON_SNAPSHOT only for a deliberate change to the crater itself.
    const file = new URL('./fixtures/moon-crater-snapshot.json', import.meta.url);
    if (process.env.WRITE_MOON_SNAPSHOT || !existsSync(file))
      writeFileSync(file, `${JSON.stringify(snapshot)}\n`);
    expect(snapshot).toEqual(JSON.parse(readFileSync(file, 'utf8')));
  });

  it('shows no district, lot, label or site to a town before the era', () => {
    const before = { ...signalTown(), era: 'hollow-rising' };
    expect(moonDistrictsShown(before)).toEqual([]);
    expect(moonLotsShown(before).some(moonLotDistrict)).toBe(false);
    expect(moonLabelAnchors(before).map(({ id }) => id)).not.toContain(QUIET_STONE.id);
    expect(signalStage(before)).toBeNull();
    expect(quietStoneLabel(before)).toBeNull();
    expect(signalLetters(before)).toEqual([]);
    // In the era, once it is open to players.
    const open = ERA_BY_ID[ERA].enabled;
    expect(moonDistrictsShown(signalTown())).toEqual(open ? [FAR_RIM] : []);
    expect(moonLotsShown(signalTown()).filter(moonLotDistrict)).toEqual(
      open ? farLots.map(([id]) => id) : [],
    );
  });

  it('levels the hollow and its road only once the district is opened', () => {
    const [cx, cz] = FAR_RIM.centre;
    const open = [FAR_RIM];
    // Today the rim crosses the district: its ground is far from level.
    let roughest = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.1)
      for (const r of [0, 12, 24, FAR_RIM.floor - 1]) {
        const [x, z] = [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
        roughest = Math.max(roughest, Math.abs(moonHeight(x, z)));
        expect(moonHeight(x, z, open)).toBe(0);
      }
    expect(roughest).toBeGreaterThan(2);
    const [[ax, az], [bx, bz]] = FAR_RIM.road;
    for (let t = 0; t <= 1; t += 0.02)
      for (const across of [-0.8, 0, 0.8])
        expect(moonHeight(ax + (bx - ax) * t + across, az + (bz - az) * t, open)).toBe(0);
    // Beyond the blend the land is untouched, and nowhere does it step.
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const r = FAR_RIM.floor + FAR_RIM.blend + 9,
        [x, z] = [cx + Math.cos(a) * r, cz + Math.sin(a) * r];
      if (moonSegmentDistance(x, z, FAR_RIM.road[0], FAR_RIM.road[1]) > 12)
        expect(moonHeight(x, z, open)).toBe(moonHeight(x, z));
    }
    let steepest = 0;
    for (let x = cx - 70; x < cx + 70; x += 1)
      for (let z = cz - 70; z < cz + 70; z += 1)
        steepest = Math.max(
          steepest,
          Math.abs(moonHeight(x + 1, z, open) - moonHeight(x, z, open)),
        );
    expect(steepest).toBeLessThan(1.6);
  });

  it('stands every Far Rim lot and site on level ground, facing the stone, clear of the roads', () => {
    const [cx, cz] = FAR_RIM.centre;
    const court = AREA_BY_ID['voyagers-court'];
    const parcels = [
      ...farLots.map(([id, at]) => [id, at, moonPadRadius(id)]),
      [court.id, court.positions[0], court.radius],
    ];
    expect(moonDistrictAt(...court.positions[0])).toBe(FAR_RIM);
    for (const [id, [x, z], radius] of parcels) {
      expect(moonOnLevelGround(x, z, radius), id).toBe(true);
      expect(Math.hypot(x, z), id).toBeGreaterThan(MOON_ROADS.rings.at(-1) + 20);
      // Nothing stands inside the ring: the ground round the stone stays empty.
      expect(Math.hypot(x - cx, z - cz) - radius - FAR_RIM.ring, id).toBeGreaterThan(2.5);
      expect(moonSegmentDistance(x, z, ...FAR_RIM.road) - radius, id).toBeGreaterThan(2);
      for (const [other, [ox, oz], otherRadius] of parcels)
        if (other !== id)
          expect(Math.hypot(x - ox, z - oz), `${id} ${other}`).toBeGreaterThan(
            radius + otherRadius,
          );
    }
    // The side toward Earth, behind the stone on the sight line, stays open.
    const away = [Math.sin(FAR_RIM.stone.turn + Math.PI), Math.cos(FAR_RIM.stone.turn + Math.PI)];
    for (const [id, [x, z]] of farLots) {
      const along = ((x - cx) * away[0] + (z - cz) * away[1]) / Math.hypot(x - cx, z - cz);
      expect(along, id).toBeLessThan(0.95);
    }
    // The road leaves the crater from the end of an outer-ring spoke.
    const [start, end] = FAR_RIM.road;
    expect(Math.hypot(...start)).toBeCloseTo(MOON_ROADS.rings.at(-1), 1);
    expect(Math.hypot(end[0] - cx, end[1] - cz)).toBeCloseTo(FAR_RIM.ring, 1);
    expect(Math.hypot(cx, cz)).toBeGreaterThan(MOON_RIM_RADIUS);
  });

  it('keeps the stone one plain black slab on the sight line to Earth, 1 : 4 : 9', () => {
    const slab = quietStone(FAR_RIM);
    const [width, height, depth] = FAR_RIM.stone.size;
    expect([width / depth, height / depth].map((n) => Math.round(n * 100) / 100)).toEqual([4, 9]);
    expect(slab.children).toHaveLength(0);
    expect(slab.material.color.getHex()).toBe(0);
    expect(slab.material.isMeshBasicMaterial && !slab.material.fog).toBe(true);
    expect(slab.position.y).toBe(height / 2);
    // The default camera at (0, 66), the stone and Earth at (52, -175) lie on one line.
    const [cx, cz] = FAR_RIM.centre;
    expect(moonSegmentDistance(cx, cz, [0, 66], [52, -175])).toBeLessThan(0.3);
    slab.geometry.dispose();
    slab.material.dispose();
    const roads = districtRoads(FAR_RIM);
    expect(roads.geometry.attributes.position.count).toBeGreaterThan(0);
    roads.geometry.dispose();
    roads.material.dispose();
  });

  it('widens the SVG map to hold the district and places its labels in it', () => {
    expect(moonMapBox()).toEqual({ x: -60, y: -50, width: 120, height: 100 });
    const box = moonMapBox([FAR_RIM]);
    const [x, y] = moonMapPoint(...FAR_RIM.centre);
    expect(x).toBeGreaterThan(box.x);
    expect(x).toBeLessThan(box.x + box.width);
    expect(y - FAR_RIM.stone.size[1]).toBeGreaterThan(box.y);
    const view = { width: 900, height: 700 };
    // The crater's labels keep their place on the crater's own map.
    expect(moonMapLabel({ id: 'a', x: 26, y: 16 }, view)).toEqual(
      moonMapLabel({ id: 'a', x: 26, y: 16 }, view, moonMapBox()),
    );
    const label = moonMapLabel({ id: 'stone', x, y }, view, box);
    expect(label.x).toBeGreaterThan(0);
    expect(label.x).toBeLessThan(100);
    expect(label.y).toBeGreaterThan(0);
    expect(label.y).toBeLessThan(100);
  });
});

describe('The Far Rim: paths and residents', () => {
  const routes = () => moonApproaches().filter(({ district }) => district);

  it('joins every lot to the district ring by a clear path', () => {
    expect(routes().map(({ id }) => id)).toEqual(farLots.map(([id]) => id));
    for (const route of routes()) {
      expect(route.clear, route.id).toBe(true);
      expect(route.ring, route.id).toBe(FAR_RIM.ring);
      const end = route.points.at(-1);
      expect(
        Math.hypot(end[0] - FAR_RIM.centre[0], end[1] - FAR_RIM.centre[1]),
        route.id,
      ).toBeCloseTo(FAR_RIM.ring, 8);
    }
  });

  it('walks between the Far Rim and the crater by the district road, and stays on roads', () => {
    const all = moonApproaches();
    const find = (id) => all.find((route) => route.id === id);
    const [homes, workshop, commons] = ['farRimHomes', 'resonanceWorkshop', 'newHollowCommons'].map(
      find,
    );
    const near = moonSettlerRoute(homes, workshop);
    // Inside the district the walk follows its ring road.
    for (const [x, , z] of near.points.slice(homes.points.length, -workshop.points.length))
      expect(
        Math.abs(Math.hypot(x - FAR_RIM.centre[0], z - FAR_RIM.centre[1]) - FAR_RIM.ring),
      ).toBeLessThan(0.5);
    for (const [from, to] of [
      [homes, commons],
      [commons, homes],
    ]) {
      const walk = moonSettlerRoute(from, to);
      expect(walk.points.flat().every(Number.isFinite)).toBe(true);
      const onRoad = (corner) =>
        walk.points.some(([x, , z]) => Math.hypot(x - corner[0], z - corner[1]) < 1e-6);
      expect(onRoad(FAR_RIM.road[0])).toBe(true);
      expect(onRoad(FAR_RIM.road[1])).toBe(true);
      expect(walk.length).toBeGreaterThan(Math.hypot(...FAR_RIM.centre) - 30);
    }
  });

  it('gathers visitors at the terrace, standing and facing the stone', () => {
    const terrace = moonApproaches().find(({ id }) => id === 'signalTerrace');
    expect(terrace.outlook).toEqual([...FAR_RIM.centre]);
    const levels = { farRimHomes: 1, signalTerrace: 1 };
    const plan = moonSettlerPlan(levels, 200, 'farRimHomes', [], 'settler', { local: true });
    const standing = plan.segments.filter((segment) => segment.stand);
    expect(standing.length).toBeGreaterThan(0);
    expect(plan.segments.some((segment) => segment.inside === 'signalTerrace')).toBe(false);
    for (const segment of standing) expect(segment.face.slice(0, 3)).toHaveLength(3);
  });

  it('adds Far Rim settlers and Willowkin who keep to the district', () => {
    const d = new TownPrimitives();
    try {
      const crater = { ribbonLanding: 1, settlerDomes: 2, newHollowCommons: 1 };
      const before = createMoonSettlers(d, new Group(), crater);
      const levels = {
        ...crater,
        farRimHomes: 2,
        tonewoodConservatory: 1,
        resonanceWorkshop: 1,
        listeningHouse: 1,
      };
      const after = createMoonSettlers(d, new Group(), levels);
      const rim = after.filter(({ plan }) => moonLotDistrict(plan.home));
      expect(rim.filter(({ species }) => !species)).toHaveLength(3);
      expect(rim.filter(({ species }) => species === 'willowkinResident')).toHaveLength(3);
      expect(after.length - rim.length).toBe(before.length);
      const stops = (plan) =>
        plan.segments.flatMap(({ route }) => (route ? [route.from, route.to] : []));
      for (const { plan } of rim)
        for (const id of stops(plan)) expect(moonLotDistrict(id), plan.home).toBe(FAR_RIM);
      // Shared skeleton: arms and legs for the gait, as every settler has.
      for (const settler of rim.filter(({ species }) => !species)) {
        expect(settler.arms).toHaveLength(2);
        expect(settler.legs).toHaveLength(2);
      }
    } finally {
      d.disposePrimitives();
    }
  });
});

describe('The Far Rim: the story', () => {
  // The era's content can be read before it opens: stages follow building levels.
  const stageOf = (levels) =>
    ERA_BY_ID[ERA].enabled ? signalStage(signalTown(levels)) : stageWhenOpen(levels);
  // While the era is disabled a town cannot reach it, so the stage rule is read directly.
  const stageWhenOpen = (levels) => {
    const level = (id) => levels[id] ?? 0;
    if (level('signalTerrace') >= 3) return 'answered';
    if (level('signalTerrace') >= 1) return 'answer';
    if (level('listeningHouse') >= 2 && level('resonanceWorkshop') >= 1) return 'understand';
    return level('listeningHouse') >= 1 ? 'listen' : 'arrival';
  };

  it('moves through Listen, Understand and Answer as the district is built', () => {
    expect(SIGNAL_STAGES).toEqual(['arrival', 'listen', 'understand', 'answer', 'answered']);
    expect(stageOf({})).toBe('arrival');
    expect(stageOf({ listeningHouse: 1 })).toBe('listen');
    expect(stageOf({ listeningHouse: 2, resonanceWorkshop: 1 })).toBe('understand');
    expect(stageOf({ listeningHouse: 2, resonanceWorkshop: 2, signalTerrace: 1 })).toBe('answer');
    expect(stageOf({ signalTerrace: 3 })).toBe('answered');
    if (!ERA_BY_ID[ERA].enabled) return;
    const town = signalTown({ signalTerrace: 3, listeningHouse: 3, resonanceWorkshop: 3 });
    expect(signalAnswered(town)).toBe(true);
    expect(signalAnswered(signalTown({ signalTerrace: 2 }))).toBe(false);
    const letters = signalLetters(town);
    expect(letters).toHaveLength(8);
    expect(new Set(letters.map(({ id }) => id)).size).toBe(8);
    expect(letters.at(-1).id).toBe('signal-answered');
    expect(signalLetters(signalTown()).map(({ id }) => id)).toEqual([
      'signal-first-pulse',
      'signal-too-small',
    ]);
    expect(quietStoneLabel(signalTown())).toEqual({
      ...QUIET_STONE,
      line: 'Still and silent',
    });
    expect(quietStoneLabel(town).line).toBe('It answered');
    expect(moonLabelAnchors(town).map(({ id }) => id)).toContain(QUIET_STONE.id);
  });

  it('draws one fixed star map inside the ring, with a single path through it', () => {
    const { stars, path } = starMap(FAR_RIM.ring);
    expect(starMap(FAR_RIM.ring)).toEqual({ stars, path });
    expect(stars.length).toBeGreaterThan(25);
    for (const [along, across] of stars) {
      expect(Math.hypot(along, across)).toBeLessThan(FAR_RIM.ring - 2);
      expect(Math.abs(across)).toBeGreaterThanOrEqual(0.9);
      expect(along).toBeGreaterThan(0);
    }
    expect(path.length).toBeGreaterThan(3);
    expect(new Set(path).size).toBe(path.length);
    for (let n = 1; n < path.length; n++)
      expect(stars[path[n]][0]).toBeGreaterThan(stars[path[n - 1]][0]);
  });

  it('pulses every ninety-one seconds and rests in between', () => {
    expect(SIGNAL_PULSE).toBe(91);
    expect(signalPulse(0)).toBe(0);
    expect(signalPulse(3)).toBeCloseTo(1);
    expect(signalPulse(40)).toBe(0);
    expect(signalPulse(94)).toBeCloseTo(1);
  });
});

describe('The Far Rim: buildings and monuments drawn', () => {
  it.each(KINDS)('keeps %s on its pad, growing with each level, in the Moon palette', (kind) => {
    const d = new TownPrimitives();
    try {
      const counts = [];
      for (const level of [1, 2, 3]) {
        const root = renderMoonBuilding(d, new Group(), kind, level);
        root.updateMatrixWorld(true);
        let meshes = 0;
        const materials = new Set();
        root.traverse((part) => {
          if (!part.isMesh) return;
          meshes++;
          materials.add(part.material);
          if (part.userData.parcelPad) return;
          const box = new Box3().setFromObject(part);
          const [mx, mz] = [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
          for (const [x, z] of [
            [box.min.x, mz],
            [box.max.x, mz],
            [mx, box.min.z],
            [mx, box.max.z],
          ])
            expect(
              beyondPad(x, z, moonPadRadius(kind)),
              `${kind} L${level} ${part.name}`,
            ).toBeLessThan(0);
        });
        counts.push(meshes);
        expect(materials.size, `${kind} L${level} materials`).toBeLessThanOrEqual(9);
        // Moving parts rest at time 0 and move without leaving the pad's air.
        root.traverse((part) => {
          if (!part.userData.moonMotion) return;
          expect(part.userData.animated).toBe(true);
          part.userData.moonMotion(3);
          part.userData.moonMotion(0);
        });
      }
      expect(counts[1], kind).toBeGreaterThan(counts[0]);
      expect(counts[2], kind).toBeGreaterThan(counts[1]);
    } finally {
      d.disposePrimitives();
    }
  });

  it('keeps the Signal Terrace low, so the stone shows over it from New Hollow', () => {
    const d = new TownPrimitives();
    try {
      const root = renderMoonBuilding(d, new Group(), 'signalTerrace', 3);
      expect(new Box3().setFromObject(root).max.y).toBeLessThan(3.2);
      expect(FAR_RIM.stone.size[1]).toBeGreaterThan(9);
    } finally {
      d.disposePrimitives();
    }
  });

  it.each(KINDS)('draws %s as an illustration at every stage', async (kind) => {
    expect([...SIGNAL_DRAWINGS].sort()).toEqual([...KINDS].sort());
    const stages = new Set();
    for (const level of [0, 1, 2, 3]) {
      const html = await svg(TownMoonBuilding, { kind, level });
      expect(html).not.toMatch(/NaN|undefined/);
      expect(html).toContain(`data-moon-form="${kind}"`);
      expect(html).not.toMatch(/<(rect|circle|ellipse|path)(?![^>]*\b(fill|stroke)=)[^>]*>/);
      stages.add(html);
    }
    expect(stages.size).toBe(4);
  });

  it('draws the Stonewatch finish in three steps, in 3D and as an illustration', async () => {
    const d = new TownPrimitives();
    try {
      const count = (finish) => {
        let meshes = 0;
        renderMoonBuilding(d, new Group(), 'starwatchDish', 3, finish).traverse(
          (part) => (meshes += part.isMesh ? 1 : 0),
        );
        return meshes;
      };
      const counts = [0, 1, 2, 3].map((level) => count({ era: ERA, level }));
      for (let n = 1; n < counts.length; n++) expect(counts[n]).toBeGreaterThan(counts[n - 1]);
      expect(count({ era: 'hollow-rising', level: 3 })).toBe(counts[0]);
    } finally {
      d.disposePrimitives();
    }
    expect(moonFinishDrawing('starwatchDish', { era: ERA, level: 0 })).toBeNull();
    const drawn = new Set();
    for (const level of [1, 2, 3]) {
      const html = await svg(TownMoonBuilding, {
        kind: 'starwatchDish',
        level: 3,
        finish: { era: ERA, level },
      });
      expect(html).toContain(`data-moon-finish="${ERA}:${level}"`);
      expect(html).not.toMatch(/NaN|undefined/);
      drawn.add(html);
    }
    expect(drawn.size).toBe(3);
  });

  it.each(AREA_BY_ID['voyagers-court'].choices)(
    'develops %s over five levels, in 3D and as an illustration',
    async (choice) => {
      expect(SIGNAL_LANDMARK_FORMS).toContain(LANDMARK_BY_ID[choice].form);
      const d = new TownPrimitives();
      try {
        const counts = [],
          heights = [];
        for (const stage of [1, 2, 3, 4, 5]) {
          const root = buildLandmark(d, new Group(), choice, stage);
          let meshes = 0;
          root.traverse((part) => (meshes += part.isMesh ? 1 : 0));
          counts.push(meshes);
          const bounds = new Box3().setFromObject(root);
          heights.push(bounds.max.y);
          // Within the site's radius, so it never reaches the road or the terrace.
          for (const edge of [bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z])
            expect(Math.abs(edge), `${choice} ${stage}`).toBeLessThan(
              AREA_BY_ID['voyagers-court'].radius,
            );
        }
        for (let n = 1; n < 5; n++)
          expect(counts[n], `${choice} ${n + 1}`).toBeGreaterThan(counts[n - 1]);
        expect(heights[4]).toBeGreaterThanOrEqual(heights[0]);
        // Apart from the stone: shorter than it at every level.
        expect(Math.max(...heights)).toBeLessThan(FAR_RIM.stone.size[1]);
      } finally {
        d.disposePrimitives();
      }
      const drawn = new Set();
      for (const stage of [1, 2, 3, 4, 5]) {
        const html = await renderToString(
          createSSRApp({ render: () => h(TownLandmarkPreview, { choice, stage }) }),
        );
        expect(html).not.toMatch(/NaN|undefined/);
        drawn.add(html);
      }
      expect(drawn.size).toBe(5);
    },
  );
});
