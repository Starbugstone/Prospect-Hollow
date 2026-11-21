import { readFileSync } from 'node:fs';
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
  // Sizes where the label slides exactly to an edge and comes back a rounding error past it.
  ['short landscape map', { width: 844, height: 360 }],
  ['large phone', { width: 430, height: 932 }],
  ['phone 414', { width: 414, height: 896 }],
  ['small landscape phone', { width: 667, height: 375 }],
  ['landscape phone 812', { width: 812, height: 375 }],
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

// Turning village names off hides every ordinary label, but not the stone's target, nor the
// name and line a tap on the stone shows (town.css): both carry the class the rule spares.
it('keeps the stone answering with village names turned off', async () => {
  const css = readFileSync('src/styles/town.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const hiding = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, , body]) => /display:\s*none/.test(body))
    .flatMap(([, selectors]) => selectors.split(/,(?![^(]*\))/).map((value) => value.trim()))
    .filter((selector) => selector.startsWith('.town-labels-hidden'));
  const lots = hiding.filter((selector) => selector.includes('.town-moon-lots'));
  // Only the lots' children are hidden, never the container the stone's target sits in.
  expect(lots.length).toBeGreaterThan(0);
  for (const selector of lots) {
    expect(selector).toMatch(/\.town-moon-lots\s*>\s*:not\(/);
    expect(selector).toContain('.town-moon-landmark');
    expect(selector).toMatch(/[ ,(]\.landmark\)/);
  }
  const town = { ...createTown(), era: 'quiet-signal' };
  const { root } = await fallbackMoon(town, { width: 390, height: 844 });
  expect(stoneTarget(root).props.class).toContain('town-moon-landmark');
  stoneTarget(root).props.onClick({ detail: 1 });
  await settle();
  expect(String(stoneLabel(root).props.class).split(' ')).toContain('landmark');
});
