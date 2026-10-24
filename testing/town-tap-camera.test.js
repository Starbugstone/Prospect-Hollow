import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { parse } from 'vue/compiler-sfc';
import { createTown } from '../src/data/town';
import { areasForSettlement } from '../src/data/townLandmarks';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { PLOTS } from '../src/game/town/TownLayout';

// The player asked that a tap on a building in the valley never moves the camera: the
// building's card opens over the view they chose. Lists, notices and links that name a
// place elsewhere in town may still take the camera to it.

const SIZE = 400;

function valley(town, [x, z]) {
  const camera = new PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(x + 6, 18, z + 20);
  camera.lookAt(x, 0, z);
  camera.updateMatrixWorld();
  const d = Object.assign(Object.create(TownDiorama.prototype), {
    town,
    targets: [],
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: SIZE, height: SIZE }) },
    raycaster: new Raycaster(),
    camera,
    controls: { target: new Vector3(x, 2, z), update: vi.fn() },
    overview: false,
    showVillager: () => false,
    render: vi.fn(),
    onSelect: vi.fn(),
  });
  return d;
}
// Taps the ground point on screen, then reports where the camera ended up.
function tap(d, [x, z]) {
  const before = [d.camera.position.toArray(), d.controls.target.toArray()];
  const screen = new Vector3(x, 0.08, z).project(d.camera);
  expect(d.pickTown(((screen.x + 1) / 2) * SIZE, ((1 - screen.y) / 2) * SIZE)).toBe(true);
  expect([d.camera.position.toArray(), d.controls.target.toArray()]).toEqual(before);
  expect(d.controls.update).not.toHaveBeenCalled();
}

describe('A tap in the valley leaves the camera alone', () => {
  it('selects a plot without moving the camera or its orbit target', () => {
    const d = valley(createTown(), PLOTS.well);
    tap(d, PLOTS.well);
    expect(d.onSelect).toHaveBeenCalledWith('well');
  });

  it('selects a monument site without moving the camera or its orbit target', () => {
    const site = areasForSettlement()[0];
    const town = createTown();
    town.era = site.era;
    const d = valley(town, site.positions[0]);
    tap(d, site.positions[0]);
    expect(d.onSelect).toHaveBeenCalledWith(site.id);
  });
});

// The scene reports both a tap on the valley and a click on a floating label as `select`
// (or `inspect` for a read-only town); the village view must open the card for it with
// KEEP_CAMERA, which skips the focusPlace move other routes keep.
describe('The village view opens a tapped building in place', () => {
  const source = readFileSync('src/components/town/TownView.vue', 'utf8');
  const { descriptor } = parse(source);
  const script = descriptor.scriptSetup.content;
  const find = (node, tag) => {
    if (node.tag === tag) return node;
    for (const child of node.children ?? []) {
      const found = find(child, tag);
      if (found) return found;
    }
    return null;
  };
  const handler = (element, event) =>
    element.props.find((prop) => prop.name === 'on' && prop.arg?.content === event)?.exp?.content;
  // The body of a top-level function in the script, by brace matching.
  const body = (name) => {
    const start = script.search(new RegExp(`function ${name}\\(`));
    expect(start, name).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = script.indexOf('{', start); i < script.length; i++) {
      if (script[i] === '{') depth++;
      else if (script[i] === '}' && --depth === 0) return script.slice(start, i + 1);
    }
    throw new Error(`Unclosed function ${name}`);
  };

  it('routes map and label taps with KEEP_CAMERA', () => {
    const scene = find(descriptor.template.ast, 'TownScene');
    expect(scene).not.toBeNull();
    expect(handler(scene, 'select')).toBe('selectBuilding($event, KEEP_CAMERA)');
    expect(handler(scene, 'inspect')).toBe('inspectBuilding($event, KEEP_CAMERA)');
    expect(script).toMatch(/const KEEP_CAMERA = false;/);
  });

  it('outlines a monument site while its card is open', () => {
    const scene = find(descriptor.template.ast, 'TownScene');
    const selected = scene.props.find((prop) => prop.arg?.content === 'selected');
    expect(selected.exp.content).toBe("dialogMode === 'monument' ? monumentSite : selected");
  });

  it('still takes the camera to the place a need chip or the Moon chip names', () => {
    const scene = find(descriptor.template.ast, 'TownScene');
    expect(handler(scene, 'locate')).toBe('inspectBuilding');
    const map = readFileSync('src/components/town/TownScene.vue', 'utf8');
    expect(map).toContain(`@click="emit('locate', chip.id)"`);
    expect(map).toContain(`return emit('locate', 'spaceElevator')`);
  });

  it('passes KEEP_CAMERA through every card a tap can open', () => {
    const select = body('selectBuilding');
    expect(select).toMatch(/^function selectBuilding\(id, locate = true\)/);
    expect(select).toContain('openMonument(id, locate)');
    expect(select).toContain('inspectBuilding(id, locate)');
    // Finishing a ready building from a tap keeps the camera even if the town grows.
    expect(select).toContain('finishBuilding(id, false, locate)');
    expect(body('finishBuilding')).toContain('showConstruction(keepDirectory, locate)');
    expect(body('showConstruction')).toContain('keepCamera: locate === KEEP_CAMERA');
    expect(readFileSync('src/components/town/TownScene.vue', 'utf8')).toContain(
      'keepCamera: newConstruction && !!props.construction?.keepCamera',
    );
    expect(select).not.toContain('focusPlace');
    for (const name of ['inspectBuilding', 'openMonument']) {
      const opened = body(name);
      expect(opened).toMatch(new RegExp(`function ${name}\\(id, locate = true\\)`));
      const moves = opened.split('\n').filter((line) => line.includes('focusPlace'));
      expect(moves.length, name).toBeGreaterThan(0);
      for (const line of moves) expect(line, name).toMatch(/if \(locate !== KEEP_CAMERA\)/);
    }
  });
});
