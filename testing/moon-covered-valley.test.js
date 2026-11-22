import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { h } from 'vue';
import TownScene from '../src/components/town/TownScene.vue';
import { createTown } from '../src/data/town';
import { clientComponent, findNode, mountComponent, settle } from './helpers/componentMount';

// While the Moon covers the valley, Tab and Enter must not reach the valley's hidden
// controls: they are inert. Focus moves into the Moon as it opens and back to the valley
// as it closes, unless the player is working elsewhere on the page.
const focus = vi.hoisted(() => ({ log: [] }));
vi.mock('../src/components/town/TownMoonView.vue', async () => {
  const { h } = await import('vue');
  // The fake nodes have no selectors: the Moon's root answers for its canvas.
  const answer = (root) => {
    if (root)
      root.querySelector = (selector) => {
        const [canvas] = root.children;
        canvas.focus = () => focus.log.push(canvas);
        return selector === 'canvas, button' ? canvas : null;
      };
  };
  return {
    default: {
      name: 'TownMoonView',
      inheritAttrs: false,
      setup(_, { expose }) {
        expose({ cameraAction() {}, focusPlace: () => true, resetView() {} });
        return () => h('section', { ref: answer, 'data-map': 'moon' }, [h('canvas')]);
      },
    },
  };
});

const SCENE = 'src/components/town/TownScene.vue';
const WATER = { id: 'well', stat: 'water', icon: 'water', value: 3, label: 'Water' };
let pinia;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  vi.stubGlobal('document', {
    activeElement: null,
    body: { nodeName: 'BODY' },
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  document.activeElement = document.body;
  focus.log = [];
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

// The valley's 3D scene, as a recorder that answers nothing.
function recorder() {
  const scene = { animals: [], vipArrivals: { reset() {} } };
  return new Proxy(scene, { get: (_, key) => (scene[key] ??= vi.fn()) });
}
async function valley() {
  const town = { ...createTown(), era: 'twin-hollows' };
  let state;
  const Scene = clientComponent(TownScene, SCENE, undefined, (setup) => {
    setup.scene = recorder();
    state = setup;
  });
  // What TownView and a shared visit call: the scene's exposed methods.
  let exposed;
  const View = {
    render: () => h(Scene, { town, now: 0, needChips: [WATER], ref: (scene) => (exposed = scene) }),
  };
  const { root, unmount } = mountComponent(View, {}, { pinia });
  await settle();
  // Every node records its focus.
  const track = (node) => {
    node.focus = () => focus.log.push(node);
    node.children.forEach(track);
  };
  track(root);
  return { root, state, exposed, unmount };
}
const byClass = (root, name) =>
  findNode(root, (node) =>
    String(node.props.class ?? '')
      .split(' ')
      .includes(name),
  );
const moonMap = (root) => findNode(root, (node) => node.props['data-map'] === 'moon');
// The valley's own controls: its camera canvas, labels and action buttons, need chips.
const valleyControls = (root) => [
  findNode(root, (node) => node.type === 'canvas' && !moonMap(root)?.children.includes(node)),
  byClass(root, 'town-scene-labels'),
  byClass(root, 'town-action-icons'),
  byClass(root, 'town-map-needs'),
];

it('makes the covered valley inert while the Moon is open, and live again after', async () => {
  const { root, state, unmount } = await valley();
  const controls = valleyControls(root).filter(Boolean);
  expect(controls.length).toBeGreaterThanOrEqual(3);
  expect(controls.map((node) => !!node.props.inert)).toEqual(controls.map(() => false));
  state.showSettlement('moon');
  await settle();
  expect(moonMap(root)).toBeTruthy();
  expect(moonMap(root).props.inert).toBeFalsy();
  expect(controls.map((node) => node.props.inert)).toEqual(controls.map(() => true));
  state.closeSettlement();
  await settle();
  expect(moonMap(root)).toBeFalsy();
  expect(controls.map((node) => node.props.inert)).toEqual(controls.map(() => false));
  unmount();
});

it('moves focus into the Moon as it opens and back to the valley as it closes', async () => {
  const { root, state, unmount } = await valley();
  const valleyCanvas = valleyControls(root)[0];
  state.showSettlement('moon');
  await settle();
  const moonCanvas = moonMap(root).children[0];
  expect(focus.log).toEqual([moonCanvas]);
  // The Moon's own close button had focus; it leaves with the Moon.
  document.activeElement = document.body;
  state.closeSettlement();
  await settle();
  expect(focus.log).toEqual([moonCanvas, valleyCanvas]);
  unmount();
});

it('leaves focus that is elsewhere on the page where it is', async () => {
  const { state, unmount } = await valley();
  // A Build row outside the map opened the Moon lot.
  const buildRow = { isConnected: true, focus: () => focus.log.push('build row') };
  document.activeElement = buildRow;
  state.showSettlement('moon');
  await settle();
  state.closeSettlement();
  await settle();
  expect(focus.log).toEqual([]);
  unmount();
});

// Find visitor / Find me (the guestbook, a visitor notice, a shared visit) shows a visitor
// who walks the valley: the Moon covering it closes first. The camera moves only for this
// explicit command; a visitor who has left keeps the Moon on screen.
it('reveals the valley before finding a visitor who is there', async () => {
  const { root, state, exposed, unmount } = await valley();
  state.showSettlement('moon');
  await settle();
  state.scene.canFindVisitor.mockReturnValue(true);
  state.scene.findVisitor.mockReturnValue(true);
  expect(exposed.findVisitor('visitor-1')).toBe(true);
  await settle();
  expect(moonMap(root)).toBeFalsy();
  expect(state.scene.findVisitor).toHaveBeenCalledWith('visitor-1');
  unmount();
});

it('keeps the Moon on screen when the visitor has left', async () => {
  const { root, state, exposed, unmount } = await valley();
  state.showSettlement('moon');
  await settle();
  state.scene.canFindVisitor.mockReturnValue(false);
  expect(exposed.findVisitor('visitor-1')).toBe(false);
  await settle();
  expect(moonMap(root)).toBeTruthy();
  expect(state.scene.findVisitor).not.toHaveBeenCalled();
  unmount();
});
