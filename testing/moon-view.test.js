import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TownMoonView from '../src/components/town/TownMoonView.vue';
import TownScene from '../src/components/town/TownScene.vue';
import { createTown } from '../src/data/town';
import { buildingActionLabel } from '../src/data/townIndicators';
import {
  LANDMARK_BY_ID,
  advanceMonumentWorks,
  areasForSettlement,
  landmarkOffer,
  monumentWork,
  purchaseLandmark,
} from '../src/data/townLandmarks';
import { bound, find, renderFragment, sfc } from './helpers/componentFragments';

// The Moon map keeps the valley's contracts (AGENTS.md, settlement maps): the same
// action labels, read-only view, upgrade glow rule, input ownership and navigation.
const MOON = 'src/components/town/TownMoonView.vue';
const SCENE = 'src/components/town/TownScene.vue';
const moonAst = sfc(MOON).template.ast;
const sceneAst = sfc(SCENE).template.ast;
const byClass = (ast, name) =>
  find(ast, (node) =>
    node.props?.some((prop) => prop.name === 'class' && prop.value?.content === name),
  ).loc.source;

let pinia;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

const moonTown = () => ({ ...createTown(), era: 'twin-hollows', coins: 1e8, moonstones: 1e6 });
// A Moon monument whose first level waits to be unveiled.
function readySite(area) {
  let town = moonTown();
  const choice = area.choices[0];
  town = purchaseLandmark(town, {
    id: area.id,
    slot: 0,
    value: choice,
    ...landmarkOffer(town, area, choice),
  });
  while (!monumentWork(town, area).ready) town = advanceMonumentWorks(town);
  return { town, choice };
}
// One fragment of the Moon view, with the scene's projected labels for `ids`.
function moonView(template, props, ids, prepare) {
  return renderFragment({
    component: TownMoonView,
    path: MOON,
    template,
    props,
    pinia,
    prepare(state) {
      state.viewport.value = { width: 1200, height: 800 };
      state.labels.value = ids.map((id, n) => ({ id, x: 30 + n * 20, y: 50, visible: true }));
      prepare?.(state);
    },
  });
}

describe('Moon monuments ready to unveil', () => {
  it.each(areasForSettlement('moon').map((area) => [area.id, area]))(
    'names %s’s unveiling on its action icon, as the valley names its own',
    async (id, area) => {
      const { town, choice } = readySite(area);
      const unveil = `Unveil the ${LANDMARK_BY_ID[choice].label}`;
      expect(buildingActionLabel(town, id, 'ready')).toBe(unveil);
      const html = await moonView(
        byClass(moonAst, 'town-action-icons'),
        { town, indicators: { [id]: 'ready' } },
        [id],
      );
      expect(html).toContain(`aria-label="${unveil}"`);
      expect(html).toContain(`data-moon-action="${id}"`);
    },
  );
  it('names a valley site’s unveiling from the same shared label', () => {
    const area = areasForSettlement('valley')[0];
    let town = { ...createTown(), era: area.era, coins: 1e9 };
    const choice = area.choices[0];
    town = purchaseLandmark(town, {
      id: area.id,
      slot: 0,
      value: choice,
      ...landmarkOffer(town, area, choice),
    });
    while (!monumentWork(town, area).ready) town = advanceMonumentWorks(town);
    expect(buildingActionLabel(town, area.id, 'ready')).toBe(
      `Unveil the ${LANDMARK_BY_ID[choice].label}`,
    );
  });
});

describe('A read-only Moon shows levels only, as the valley does', () => {
  it('never invites a visitor to build, finish or choose a design', async () => {
    const area = areasForSettlement('moon')[0];
    const town = moonTown();
    town.buildings = { ...town.buildings, spaceElevator: 1, ribbonLanding: 2 };
    town.projects = { settlerDomes: { id: 'settlerDomes', stage: 1, wins: 2, required: 2 } };
    const ids = ['ribbonLanding', 'settlerDomes', 'craterIceWell', area.id];
    const props = {
      town,
      indicators: { settlerDomes: 'ready' },
      availableIds: ['craterIceWell'],
    };
    const lots = byClass(moonAst, 'town-moon-lots');
    const owner = await moonView(lots, props, ids);
    expect(owner).toMatch(/Tap to finish|Build|Choose a design/);
    // The valley's look for a place to build.
    expect(owner).toMatch(/class="town-moon-lot[^"]*can-build/);
    const visitor = await moonView(lots, { ...props, readOnly: true }, ids);
    expect(visitor).toContain('Lv. 2');
    expect(visitor).not.toMatch(/Tap to finish|Build|Choose a design|Under construction/);
    expect(visitor).not.toMatch(/class="town-moon-lot[^"]*(can-build|is-ready)/);
  });
});

describe('One label renderer for both maps', () => {
  it('draws valley and Moon labels and action icons with the same components', () => {
    for (const ast of [moonAst, sceneAst]) {
      expect(find(ast, (node) => node.tag === 'TownLabelStatus')).toBeTruthy();
      expect(find(ast, (node) => node.tag === 'TownActionIcon')).toBeTruthy();
    }
  });
  it('shows Moon construction as the valley does, without recomputing it per camera frame', async () => {
    const town = moonTown();
    town.buildings = { ...town.buildings, spaceElevator: 1 };
    town.projects = { settlerDomes: { id: 'settlerDomes', stage: 1, wins: 1, required: 2 } };
    const lots = byClass(moonAst, 'town-moon-lots');
    const html = await moonView(lots, { town }, ['settlerDomes']);
    // Camera frames re-render the labels: they read the statuses computed once per
    // change of the town or its markers (lotInfo), never the status functions.
    expect(lots).toContain('lotInfo[lot.id]');
    expect(lots).not.toMatch(/moonLot(Detail|Info|Label|Status)\(|status\(lot/);
    expect(html).toContain(
      '<small class="construction-count" title="Construction: 1 of 2 mining runs completed"><i data-icon="wall"></i>1/2</small>',
    );
  });
});

it('rebuilds the Moon scene for what it draws, not for coins', async () => {
  const town = reactive(moonTown());
  const seen = [];
  await moonView('<div />', { town }, [], (state) => {
    seen.push(state.visual.value);
    town.coins += 500;
    town.honours = { ...town.honours, seen: 1 };
    seen.push(state.visual.value);
    town.buildings.settlerDomes = 1;
    seen.push(state.visual.value);
  });
  expect(seen[1]).toBe(seen[0]);
  expect(seen[2]).not.toBe(seen[0]);
});

describe('The Moon’s upgrade glow follows the valley’s rule', () => {
  it('glows the lots whose indicator is "upgrade", and none during a cinematic', async () => {
    const moon = sfc(SCENE);
    // TownScene draws the open settlement's map, the Moon's being TownMoonView.
    const view = find(
      sceneAst,
      (node) => node.tag === 'component' && bound(node, 'is') === 'settlementMap',
    );
    expect(moon.scriptSetup.content).toMatch(/SETTLEMENT_MAPS = \{ moon: TownMoonView \}/);
    expect(bound(view, 'upgrade-ids')).toBe('cinematic ? [] : upgradeIds');
    expect(moon.scriptSetup.content).toMatch(/indicators\.value\[id\] === 'upgrade'/);
    const scene = { setUpgradeable: vi.fn(), setLabelActions: vi.fn() };
    await moonView(
      '<div />',
      {
        town: moonTown(),
        availableIds: ['craterIceWell', 'settlerDomes'],
        upgradeIds: ['settlerDomes'],
      },
      [],
      (state) => {
        state.scene = scene;
        state.updateGlow();
      },
    );
    expect(scene.setUpgradeable).toHaveBeenCalledWith(['settlerDomes']);
  });
});

describe('Navigation reaches the camera of the map on screen', () => {
  it('remembers a Build row’s Moon lot until the Moon scene has loaded', async () => {
    let state;
    await moonView('<div />', { town: moonTown() }, [], (setup) => (state = setup));
    expect(state.focusPlace('settlerDomes')).toBe(true);
    expect(state.pendingFocus).toBe('settlerDomes');
    const scene = { focusPlace: vi.fn(() => true) };
    state.scene = scene;
    state.focusPlace('roverBarn');
    expect(scene.focusPlace).toHaveBeenCalledWith('roverBarn');
  });

  // TownScene's setup, with fake valley and Moon cameras.
  async function townScene(prepare) {
    vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
    let state;
    await renderFragment({
      component: TownScene,
      path: SCENE,
      template: '<div />',
      props: { town: createTown(), now: 0, needChips: [] },
      pinia,
      prepare(setup) {
        state = setup;
        state.scene = {
          pick: vi.fn(),
          hoverVillager: vi.fn(),
          setCovered: vi.fn(),
          setMotion: vi.fn(),
          projectVillager: vi.fn(),
          cameraAction: vi.fn(),
          focusPlace: vi.fn(),
        };
        prepare?.(state);
      },
    });
    const moon = { cameraAction: vi.fn(), focusPlace: vi.fn(() => true) };
    state.settlementView.value = moon;
    return { state, valley: state.scene, moon };
  }
  const press = (target) => ({ pointerId: 1, clientX: 5, clientY: 5, button: 0, target });
  const onMoon = { closest: (selector) => (selector === '.town-settlement-map' ? {} : null) };
  const onValley = { closest: () => null };

  it('keeps Moon input out of the valley’s taps and camera', async () => {
    let covered;
    const { state, valley } = await townScene((setup) => {
      setup.shown.value = 'moon';
      covered = setup.scene.setCovered.mock.calls.at(-1);
      setup.shown.value = 'valley';
    });
    // While the Moon is open, the valley's camera gestures are off.
    expect(covered).toEqual([true]);
    state.rememberPointer(press(onMoon));
    state.movePointer({ ...press(onMoon), pointerType: 'mouse' });
    state.pick(press(onMoon));
    expect(valley.pick).not.toHaveBeenCalled();
    expect(valley.hoverVillager).not.toHaveBeenCalled();
    state.rememberPointer(press(onValley));
    state.pick(press(onValley));
    expect(valley.pick).toHaveBeenCalledOnce();
  });

  it('sends keys, the Village reset and Build rows to the Moon while it is open', async () => {
    const { state, valley, moon } = await townScene();
    const key = (name) => ({ key: name, preventDefault: vi.fn() });
    state.shown.value = 'moon';
    state.cameraKey(key('ArrowLeft'));
    state.resetView();
    expect(moon.cameraAction.mock.calls).toEqual([['left'], ['reset']]);
    expect(valley.cameraAction).not.toHaveBeenCalled();
    await state.focusPlace('settlerDomes');
    expect(moon.focusPlace).toHaveBeenCalledWith('settlerDomes');
    expect(valley.focusPlace).not.toHaveBeenCalled();
    // A valley place closes the Moon and moves the valley's camera.
    await state.focusPlace('well');
    expect(state.shown.value).toBe('valley');
    expect(valley.focusPlace).toHaveBeenCalledWith('well');
    state.cameraKey(key('Home'));
    expect(valley.cameraAction).toHaveBeenCalledWith('reset');
  });
});
