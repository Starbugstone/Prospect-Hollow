import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import TownScene from '../src/components/town/TownScene.vue';
import TownEraCinematic from '../src/components/town/TownEraCinematic.vue';
import { ERAS } from '../src/data/eras';
import { createTown } from '../src/data/town';
import { eraSettlement } from '../src/game/town/TownEventSettlement';
import { useCampaignStore } from '../src/stores/campaignStore';
import { find, sfc } from './helpers/componentFragments';
import {
  clientComponent,
  findNode,
  mountComponent,
  nodeText,
  settle,
} from './helpers/componentMount';

// The Moon's own map stands in for the 3D Moon: this test follows which map is on screen.
vi.mock('../src/components/town/TownMoonView.vue', async () => {
  const { h } = await import('vue');
  return {
    default: {
      name: 'TownMoonView',
      inheritAttrs: false,
      setup(_, { expose }) {
        expose({ cameraAction() {}, focusPlace: () => true, resetView() {} });
        return () => h('section', { 'data-visible-map': 'moon' });
      },
    },
  };
});

// An era built only on another settlement (New Hollow Rising, the Quiet Signal) ends its
// cinematic on that settlement's map: after the cinematic plays out and after Skip.
const VIEW = 'src/components/town/TownView.vue';
const SCENE = 'src/components/town/TownScene.vue';
const CINEMATIC = 'src/components/town/TownEraCinematic.vue';
const source = (path, tag) => find(sfc(path).template.ast, (node) => node.tag === tag).loc.source;

let frames, now, pinia, mounted;
beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
    removeItem: (key) => saves.delete(key),
  });
  vi.stubGlobal('document', {
    hidden: false,
    activeElement: null,
    body: { style: {} },
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
  });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  frames = [];
  mounted = [];
  now = 0;
  vi.stubGlobal('requestAnimationFrame', (callback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => {
  mounted.forEach((unmount) => unmount());
  vi.unstubAllGlobals();
});

// Runs animation frames `step` milliseconds apart until none is asked for.
function playFrames(step = 100) {
  while (frames.length) {
    const queued = frames.splice(0);
    now += step;
    queued.forEach((callback) => callback(now));
  }
}

// The valley's 3D scene, as a recorder: no animals, and every method answers nothing.
function recorder() {
  const scene = { animals: [] };
  return new Proxy(scene, { get: (_, key) => (scene[key] ??= vi.fn()) });
}
// The village view with its real scene wiring and era cinematic. The valley's 3D scene is
// a recorder; the scene's settlement map is drawn as in its template.
async function village(era, extra = {}) {
  const index = ERAS.findIndex(({ id }) => id === era);
  const from = ERAS[index - 1].id;
  const town = {
    ...createTown(),
    era,
    tourSeen: true,
    transition: { id: `${from}:${era}`, from, to: era, pending: true },
    ...extra,
  };
  useCampaignStore().town = town;
  let view, scene;
  const Scene = clientComponent(
    TownScene,
    SCENE,
    `<div data-visible-map="valley">${source(SCENE, 'component')}</div>`,
    (state) => {
      state.scene = recorder();
      scene = state;
    },
  );
  const Cinematic = clientComponent(TownEraCinematic, CINEMATIC);
  const View = clientComponent(
    TownView,
    VIEW,
    `<div>${source(VIEW, 'TownScene')}${source(VIEW, 'TownEraCinematic')}</div>`,
    (state) => {
      state.TownScene = Scene;
      state.TownEraCinematic = Cinematic;
      view = state;
    },
  );
  const { root, unmount } = mountComponent(View, { active: true }, { pinia });
  mounted.push(unmount);
  await settle();
  return { root, view, scene };
}
const visibleMap = (root) =>
  findNode(root, (entry) => entry.props['data-visible-map'] === 'moon') ? 'moon' : 'valley';
const button = (root, className) =>
  findNode(root, (entry) => entry.type === 'button' && entry.props.class?.includes(className));

describe('An era cinematic hands over to the settlement its era builds on', () => {
  const ways = {
    'played to the end': async ({ root, view }) => {
      view.eraReady.value = true;
      await settle();
      playFrames();
      await settle();
      const explore = button(root, 'era-explore');
      expect(nodeText(explore)).toContain('Explore the new era');
      explore.props.onClick();
    },
    skipped: async ({ root }) => button(root, 'era-skip').props.onClick(),
  };
  it.each(
    ['hollow-rising', 'quiet-signal'].flatMap((era) => Object.keys(ways).map((way) => [era, way])),
  )('%s, %s, ends on the Moon map', async (era, way) => {
    expect(eraSettlement(era)).toBe('moon');
    const mounted = await village(era);
    const { root, view, scene } = mounted;
    // The cinematic plays over the valley.
    expect(view.eraPlaying.value).toBe(true);
    expect(button(root, 'era-skip')).toBeTruthy();
    expect(visibleMap(root)).toBe('valley');
    await ways[way](mounted);
    await settle();
    expect(useCampaignStore().town.transition.pending).toBe(false);
    expect(button(root, 'era-skip')).toBeFalsy();
    expect(scene.shown.value).toBe('moon');
    expect(view.settlement.value).toBe('moon');
    expect(visibleMap(root)).toBe('moon');
  });

  // A valley presentation queued behind the cinematic plays first; the handoff waits for it.
  it('hands over after a valley presentation that plays once the cinematic is skipped', async () => {
    const { root, view, scene } = await village('quiet-signal', {
      presentations: { 'three-star-celebration': 'pending' },
    });
    button(root, 'era-skip').props.onClick();
    await settle();
    expect(view.eraPlaying.value).toBe(false);
    expect(view.openingPresentation.value?.id).toBe('three-star-celebration');
    expect(visibleMap(root)).toBe('valley');
    view.completePresentation();
    await settle();
    expect(view.openingPresentation.value).toBeFalsy();
    expect(scene.shown.value).toBe('moon');
    expect(visibleMap(root)).toBe('moon');
  });

  it('keeps an era that builds in the valley on the valley map', async () => {
    const { root, view } = await village('moonward');
    button(root, 'era-skip').props.onClick();
    await settle();
    expect(view.eraPlaying.value).toBe(false);
    expect(visibleMap(root)).toBe('valley');
  });
});
