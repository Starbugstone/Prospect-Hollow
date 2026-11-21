import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TownMoonView from '../src/components/town/TownMoonView.vue';
import { createTown } from '../src/data/town';
import { QUIET_STONE, quietStoneLabel } from '../src/data/quietSignal';
import { t } from '../src/i18n';
import {
  clientComponent,
  findNode,
  mountComponent,
  nodeText,
  settle,
} from './helpers/componentMount';

// Without WebGL the Moon is an SVG map. The Quiet Stone answers a tap or a key there as it
// does in 3D: its label shows its name and line, nothing else opens and no camera moves.
const PATH = 'src/components/town/TownMoonView.vue';

let mounted;
beforeEach(() => {
  mounted = [];
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  vi.stubGlobal('document', {
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
  mounted.forEach((unmount) => unmount());
  vi.unstubAllGlobals();
});

async function fallbackMoon(town, viewport = { width: 1200, height: 800 }) {
  let state;
  const events = { select: vi.fn(), inspect: vi.fn(), close: vi.fn() };
  const Moon = clientComponent(TownMoonView, PATH, undefined, (setup) => {
    // No 3D Moon: the SVG map draws it.
    setup.unavailable.value = true;
    setup.viewport.value = viewport;
    state = setup;
  });
  const { root, unmount } = mountComponent(Moon, {
    town,
    onSelect: events.select,
    onInspect: events.inspect,
    onClose: events.close,
  });
  mounted.push(unmount);
  await settle();
  return { root, state, events };
}
const stoneTarget = (root) =>
  findNode(root, (entry) => entry.props['data-moon-landmark-target'] === QUIET_STONE.id);
const stoneLabel = (root) =>
  findNode(root, (entry) => entry.props['data-moon-lot'] === QUIET_STONE.id);

it.each([
  ['desktop', { width: 1280, height: 800 }],
  ['phone', { width: 390, height: 844 }],
  ['landscape phone', { width: 844, height: 390 }],
])(
  'gives the Quiet Stone a tap and keyboard target that shows its description (%s)',
  async (_, viewport) => {
    const town = { ...createTown(), era: 'quiet-signal' };
    const stone = quietStoneLabel(town);
    const description = `${t(stone.name)} · ${t(stone.line)}`;
    const { root, state, events } = await fallbackMoon(town, viewport);
    expect(state.scene).toBeNull();
    const target = stoneTarget(root);
    // A native button: a pointer tap, Enter and Space all reach its click.
    expect(target?.type).toBe('button');
    expect(target.props['aria-label']).toBe(description);
    expect(target.props['aria-pressed']).toBe(false);
    // The stone stands unlabelled until it is tapped, as in 3D.
    expect(stoneLabel(root)).toBeFalsy();
    target.props.onClick({ detail: 1 });
    await settle();
    const label = stoneLabel(root);
    expect(nodeText(label)).toContain(t(stone.name));
    expect(nodeText(label)).toContain(t(stone.line));
    expect(stoneTarget(root).props['aria-pressed']).toBe(true);
    // Nothing opens: the stone is a landmark, with no card and no camera move.
    expect(events.select).not.toHaveBeenCalled();
    expect(events.inspect).not.toHaveBeenCalled();
    expect(events.close).not.toHaveBeenCalled();
    // A second tap puts the label away again, as in 3D.
    stoneTarget(root).props.onClick({ detail: 1 });
    await settle();
    expect(stoneLabel(root)).toBeFalsy();
  },
);

it('draws no stone target before the Far Rim opens', async () => {
  const { root } = await fallbackMoon({ ...createTown(), era: 'hollow-rising' });
  expect(stoneTarget(root)).toBeFalsy();
});
