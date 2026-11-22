import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TownMoonView from '../src/components/town/TownMoonView.vue';
import { createTown } from '../src/data/town';
import { clientComponent, findNode, mountComponent, settle } from './helpers/componentMount';

// When the Moon's 3D scene cannot start, the SVG map replaces its canvas. Focus on that
// canvas must not fall to the page: it moves to Back to the valley.
vi.mock('../src/game/town/moon/MoonScene', () => ({
  MoonScene: class {
    constructor() {
      throw new Error('WebGL unavailable');
    }
  },
}));

const PATH = 'src/components/town/TownMoonView.vue';
const focused = vi.hoisted(() => ({ log: [] }));
let unmount;
beforeEach(() => {
  focused.log = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  vi.stubGlobal('document', {
    activeElement: null,
    body: { nodeName: 'BODY' },
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  unmount?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function failingMoon(focusCanvas) {
  let state;
  const Moon = clientComponent(TownMoonView, PATH, undefined, (setup) => (state = setup));
  const mounted = mountComponent(Moon, { town: { ...createTown(), era: 'twin-hollows' } });
  unmount = mounted.unmount;
  const back = findNode(mounted.root, (node) =>
    String(node.props.class ?? '').includes('town-moon-back'),
  );
  back.focus = () => focused.log.push('back');
  if (focusCanvas) document.activeElement = state.canvas.value;
  await vi.waitFor(() => expect(state.unavailable.value).toBe(true));
  await settle();
  return mounted.root;
}

it('moves focus from the failed canvas to Back to the valley', async () => {
  const root = await failingMoon(true);
  expect(findNode(root, (node) => node.type === 'canvas')).toBeFalsy();
  expect(focused.log).toEqual(['back']);
});

it('leaves focus alone when the canvas did not hold it', async () => {
  await failingMoon(false);
  expect(focused.log).toEqual([]);
});
