import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Box3, DoubleSide, Group, Raycaster, Vector3 } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { MOON_FORMS, renderMoonBuilding } from '../src/game/town/buildings/moon';
import { MOON_FINISH_KINDS, moonFinish } from '../src/game/town/buildings/moonFinishes';
import {
  moonApproaches,
  moonLotPose,
  moonPadApothem,
  moonPadRadius,
} from '../src/data/moonSettlement';
import { moonRoofHeight } from '../src/game/town/moon/MoonScene';
import { finishDrawing } from '../src/components/town/moonRisingDrawings';
import TownMoonBuilding from '../src/components/town/TownMoonBuilding.vue';

const ERA = 'hollow-rising';
const KINDS = MOON_FINISH_KINDS[ERA];
const FIXTURE = new URL('./fixtures/moon-first-lot-drawings.json', import.meta.url);
// The Twin Hollows lots, whose drawings shipped before any Moon finish existed.
const FIRST_LOTS = [
  'saucerPad',
  'ribbonLanding',
  'settlerDomes',
  'craterIceWell',
  'earthlightGreenhouse',
  'willowkinDome',
  'newHollowCommons',
  'craterHomesteads',
  'moonstoneWorkshop',
  'roverBarn',
  'earthriseLookout',
];
const svg = (props) =>
  renderToString(createSSRApp({ render: () => h('svg', [h(TownMoonBuilding, props)]) }));

// Everything that decides how a drawing looks: each part's shape, colour, glass, shadow
// and place, in order. Places are rounded so the record does not depend on the last bit.
function drawing(d, root) {
  const parts = [];
  root.updateMatrixWorld(true);
  root.traverse((part) => {
    if (!part.isMesh) return;
    parts.push([
      part.name,
      Object.keys(d.geometries).find((key) => d.geometries[key] === part.geometry),
      part.material.color.getHexString(),
      part.material.transparent,
      part.castShadow,
      part.renderOrder,
      part.matrixWorld.elements.map((value) => Math.round(value * 1e5) / 1e5 || 0),
    ]);
  });
  return parts;
}
const record = (parts) => ({
  parts: parts.length,
  hash: createHash('sha1').update(JSON.stringify(parts)).digest('hex'),
});
function cost(root) {
  let triangles = 0;
  const materials = new Set();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    materials.add(mesh.material);
  });
  return { triangles, materials: materials.size };
}
const beyondPad = (x, z, radius) =>
  Math.max(
    Math.abs(x) * Math.sin(Math.PI / 8) + Math.abs(z) * Math.cos(Math.PI / 8),
    Math.abs(z) * Math.sin(Math.PI / 8) + Math.abs(x) * Math.cos(Math.PI / 8),
  ) - moonPadApothem(radius);

describe('Moon finishes: the contract', () => {
  // The record was made from the drawings as they shipped in Twin Hollows. After an
  // intended change to a first lot's art, rewrite it: UPDATE_MOON_DRAWINGS=1 npx vitest run
  // testing/moon-finishes.test.js
  it('draws every first lot exactly as it shipped when it has no finish', () => {
    const d = new TownPrimitives();
    const now = {};
    try {
      for (const kind of FIRST_LOTS)
        for (const level of [0, 1, 2, 3])
          now[`${kind}:${level}`] = record(
            drawing(d, renderMoonBuilding(d, new Group(), kind, level)),
          );
    } finally {
      d.disposePrimitives();
    }
    if (process.env.UPDATE_MOON_DRAWINGS)
      writeFileSync(FIXTURE, `${JSON.stringify(now, null, 2)}\n`);
    expect(now).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
  });

  it('adds nothing for no finish, era level 0, another era, an unlisted kind or an empty lot', () => {
    const d = new TownPrimitives();
    try {
      for (const kind of MOON_FORMS)
        for (const level of [0, 1, 2, 3]) {
          const plain = drawing(d, renderMoonBuilding(d, new Group(), kind, level));
          const same = [
            undefined,
            null,
            {},
            { era: ERA },
            { era: ERA, level: 0 },
            { era: ERA, level: -2 },
            { era: ERA, level: 'three' },
            { era: 'twin-hollows', level: 3 },
            { era: 'constructor', level: 3 },
            { era: 'no-such-era', level: 3 },
            { level: 3 },
          ];
          // A finish never draws on an empty lot, or on a building its era leaves alone.
          if (!level || !KINDS.includes(kind)) same.push({ era: ERA, level: 3 });
          for (const finish of same) {
            const root = renderMoonBuilding(d, new Group(), kind, level, finish);
            expect(drawing(d, root), `${kind} L${level} ${JSON.stringify(finish)}`).toEqual(plain);
            expect(root.userData.finish).toBeUndefined();
          }
        }
      expect(moonFinish('ribbonLanding', { era: ERA, level: 9 }).level).toBe(3);
      expect(moonFinish('toString', { era: ERA, level: 3 })).toBeNull();
    } finally {
      d.disposePrimitives();
    }
  });

  it('modernizes the five buildings the era names', () => {
    expect([...KINDS].sort()).toEqual(
      [
        'craterIceWell',
        'earthlightGreenhouse',
        'newHollowCommons',
        'ribbonLanding',
        'roverBarn',
      ].sort(),
    );
    for (const kind of KINDS) expect(FIRST_LOTS).toContain(kind);
  });
});

describe.each(KINDS)('the %s finish', (kind) => {
  it('adds to the building at every era level, keeping what was built', () => {
    const d = new TownPrimitives();
    try {
      for (const level of [1, 2, 3]) {
        const plain = drawing(d, renderMoonBuilding(d, new Group(), kind, level));
        let previous = plain;
        for (const step of [1, 2, 3]) {
          const root = renderMoonBuilding(d, new Group(), kind, level, { era: ERA, level: step });
          const parts = drawing(d, root);
          expect(root.userData.finish).toEqual({ era: ERA, level: step });
          // The building itself is untouched: its parts come first, unchanged.
          expect(parts.slice(0, plain.length)).toEqual(plain);
          expect(parts.length, `L${level} E${step}`).toBeGreaterThan(previous.length);
          previous = parts;
          const budget = cost(root);
          expect(budget.triangles).toBeLessThan(6000);
          expect(budget.materials).toBeLessThanOrEqual(8);
          expect(moonRoofHeight(root)).toBeLessThan(7.8);
        }
      }
    } finally {
      d.disposePrimitives();
    }
  });

  it('keeps its added pieces on the octagonal pad', () => {
    const d = new TownPrimitives();
    try {
      const root = renderMoonBuilding(d, new Group(), kind, 3, { era: ERA, level: 3 });
      root.updateMatrixWorld(true);
      root.getObjectByName(`Moon finish ${ERA} level 3`).traverse((part) => {
        if (!part.isMesh) return;
        const box = new Box3().setFromObject(part);
        const [cx, cz] = [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
        for (const [x, z] of [
          [box.min.x, cz],
          [box.max.x, cz],
          [cx, box.min.z],
          [cx, box.max.z],
        ])
          expect(beyondPad(x, z, moonPadRadius(kind)), `${kind} ${part.name}`).toBeLessThan(0);
        for (const v of [box.min.x, box.max.x, box.min.z, box.max.z])
          expect(Math.abs(v)).toBeLessThanOrEqual(moonPadRadius(kind) + 0.6);
      });
    } finally {
      d.disposePrimitives();
    }
  });

  it.each([1, 2, 3].flatMap((level) => [1, 2, 3].map((step) => [level, step])))(
    'leaves the hatch and the public path clear at level %s, era level %s',
    (level, step) => {
      const d = new TownPrimitives(),
        root = new Group();
      const route = moonApproaches({ [kind]: level })[0];
      const pose = moonLotPose(kind);
      root.position.set(pose.x, 0, pose.z);
      root.rotation.y = pose.rotation;
      renderMoonBuilding(d, root, kind, level, { era: ERA, level: step });
      root.traverse((part) => {
        if (part.isMesh) part.material.side = DoubleSide;
      });
      root.updateMatrixWorld(true);
      try {
        for (let n = 0; n < route.apronSegments; n++) {
          const a = route.points[n],
            b = route.points[n + 1];
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          for (let distance = n ? 0 : 0.3; distance < length; distance += 0.2) {
            const t = distance / length;
            for (const side of [-0.28, 0, 0.28]) {
              const x = a[0] + (b[0] - a[0]) * t - ((b[1] - a[1]) / length) * side;
              const z = a[1] + (b[1] - a[1]) * t + ((b[0] - a[0]) / length) * side;
              const hit = new Raycaster(
                new Vector3(x, 0.29, z),
                new Vector3(0, 1, 0),
                0,
                1.35,
              ).intersectObject(root, true)[0];
              expect(hit, `obstacle at ${x.toFixed(2)},${z.toFixed(2)}`).toBeUndefined();
            }
          }
        }
      } finally {
        d.disposePrimitives();
      }
    },
  );

  it('draws the same finish on its illustration', async () => {
    for (const level of [1, 2, 3]) {
      const plain = await svg({ kind, level });
      expect(plain).not.toContain('data-moon-finish');
      for (const finish of [null, { era: ERA, level: 0 }, { era: 'twin-hollows', level: 3 }])
        expect(await svg({ kind, level, finish })).toBe(plain);
      const stages = new Set([plain]);
      for (const step of [1, 2, 3]) {
        const html = await svg({ kind, level, finish: { era: ERA, level: step } });
        expect(html).toContain(`data-moon-finish="${ERA}:${step}"`);
        expect(html).not.toMatch(/NaN|undefined/);
        expect(html.length).toBeGreaterThan([...stages].at(-1).length);
        stages.add(html);
      }
      expect(stages.size).toBe(4);
    }
    // An empty lot stays an empty lot, and other buildings ignore the finish.
    expect(await svg({ kind, level: 0, finish: { era: ERA, level: 3 } })).toBe(
      await svg({ kind, level: 0 }),
    );
    expect(finishDrawing('settlerDomes', { era: ERA, level: 3 })).toBeNull();
  });
});
