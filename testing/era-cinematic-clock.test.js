import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TownEraCinematic from '../src/components/town/TownEraCinematic.vue';
import { ERA_CONSTRUCTION } from '../src/data/mineEvolution';
import { clientComponent, findNode, mountComponent, settle } from './helpers/componentMount';

// The era cinematic's clock advances at most a quarter second per frame, as the monument
// cinematic's does: one stalled frame on a slow phone must not play it to its end.
const PATH = 'src/components/town/TownEraCinematic.vue';
const DURATION = ERA_CONSTRUCTION.duration * 1000;

let frames, mounted;
beforeEach(() => {
  frames = [];
  mounted = [];
  vi.stubGlobal('document', {
    hidden: false,
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal('requestAnimationFrame', (callback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  mounted.forEach((unmount) => unmount());
  vi.unstubAllGlobals();
});

async function cinematic(props) {
  let state;
  const events = { complete: vi.fn(), frame: vi.fn() };
  const component = clientComponent(TownEraCinematic, PATH, undefined, (setup) => (state = setup));
  const { root, unmount } = mountComponent(component, {
    eraId: 'hollow-rising',
    ready: true,
    onComplete: events.complete,
    onFrame: events.frame,
    ...props,
  });
  mounted.push(unmount);
  await settle();
  return { root, state, events };
}
// Runs one animation frame at `now` milliseconds.
const frameAt = (now) => frames.splice(0).forEach((callback) => callback(now));
const button = (root, className) =>
  findNode(root, (entry) => entry.type === 'button' && entry.props.class?.includes(className));

it('advances a quarter second at most across a stalled frame', async () => {
  const { root, state, events } = await cinematic();
  frameAt(1000);
  frameAt(1016);
  expect(state.elapsed.value).toBe(16);
  // The tab froze for longer than the whole cinematic.
  frameAt(1016 + DURATION * 2);
  await settle();
  expect(state.elapsed.value).toBe(16 + 250);
  expect(state.finished.value).toBe(false);
  expect(button(root, 'era-skip')).toBeTruthy();
  expect(button(root, 'era-explore')).toBeFalsy();
  expect(events.complete).not.toHaveBeenCalled();
  // Ordinary frames carry on from there.
  frameAt(1016 + DURATION * 2 + 16);
  expect(state.elapsed.value).toBe(16 + 250 + 16);
});

it('still ends at once when the player skips it', async () => {
  const { root, events } = await cinematic();
  frameAt(1000);
  button(root, 'era-skip').props.onClick();
  expect(events.complete).toHaveBeenCalledOnce();
});

it('still shows its end at once with reduced motion', async () => {
  const { root, state, events } = await cinematic({ reducedMotion: true });
  expect(state.elapsed.value).toBe(DURATION);
  expect(state.finished.value).toBe(true);
  expect(button(root, 'era-explore')).toBeTruthy();
  expect(events.frame).toHaveBeenLastCalledWith(1);
  button(root, 'era-explore').props.onClick();
  expect(events.complete).toHaveBeenCalledOnce();
});
