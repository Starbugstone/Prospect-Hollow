import { describe, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Vector3, Vector4 } from 'three';
import {
  beginEventCamera,
  updateEventCamera,
  restoreEventCamera,
  renderEventInset,
  eventInsetRect,
} from '../src/game/town/TownEventCamera';
import { PLOTS } from '../src/game/town/TownLayout';

function actor(x, z, visible = true) {
  const root = new Group();
  root.position.set(x, 0, z);
  root.visible = visible;
  return { root };
}
function fixture(kind, aspect = 1.6) {
  const viewport = new Vector4(0, 0, 960, 600),
    scissor = viewport.clone();
  const d = {
    camera: new PerspectiveCamera(40, aspect, 0.1, 400),
    controls: { target: new Vector3(), enabled: true },
    canvas: { clientWidth: 960, clientHeight: 600 },
    elapsed: 0,
    frameCache: { valid: true },
    motionEnabled: true,
    onEventInset: vi.fn(),
    renderer: {
      autoClear: false,
      getViewport: (out) => out.copy(viewport),
      getScissor: (out) => out.copy(scissor),
      getScissorTest: () => false,
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      setScissorTest: vi.fn(),
      render: vi.fn(),
    },
    raid: {
      event: { kind, targets: ['blacksmith'] },
      target: 'blacksmith',
      bandits: [actor(20, -15), actor(24, -15)],
      patrol: [actor(-10, 8)],
      thieves: [actor(18, 9), actor(20, 9)],
      crew: [actor(-12, 10), actor(-11, 10)],
      vehicle: actor(-13, 10),
    },
  };
  d.camera.position.set(40, 30, 50);
  beginEventCamera(d);
  return d;
}
function settle(d) {
  for (let i = 0; i < 600; i++) {
    d.elapsed += 1 / 60;
    updateEventCamera(d);
  }
  renderEventInset(d);
}

describe('Two simultaneous views of every town incident', () => {
  it.each([
    ['bandits', 22, -15, -10, 8, 'Sheriff patrol'],
    ['cargo-theft', 19, 9, -12, 10, 'Town patrol'],
    ['workshop-fire', -12, 10, PLOTS.blacksmith[0], PLOTS.blacksmith[1] + 1.5, 'Workshop fire'],
    ['storm-cleanup', -12, 10, PLOTS.blacksmith[0], PLOTS.blacksmith[1] + 1.5, 'Storm cleanup'],
  ])('frames both sides of %s even when they are far apart', (kind, mx, mz, ix, iz, label) => {
    const d = fixture(kind);
    settle(d);
    expect(d.controls.target.x).toBeCloseTo(mx, 3);
    expect(d.controls.target.z).toBeCloseTo(mz, 3);
    expect(d.eventCamera.insetFrame.focus.x).toBeCloseTo(ix, 3);
    expect(d.eventCamera.insetFrame.focus.z).toBeCloseTo(iz, 3);
    if (d.eventCamera.mainFrame.focus.distanceTo(d.eventCamera.insetFrame.focus) >= 7)
      expect(d.onEventInset).toHaveBeenLastCalledWith(expect.objectContaining({ label }));
    else expect(d.eventInsetVisible).not.toBe(true);
    expect(d.eventCamera.insetCamera.layers.mask).toBe(5); // Scenery + animated instances.
  });
  it('keeps staggered patrol arrivals readable instead of fitting the entire town in the inset', () => {
    const d = fixture('bandits');
    d.raid.patrol = [actor(-4, -10), actor(-4, 2), actor(-4, 16)];
    settle(d);
    expect(d.eventCamera.insetFrame.focus.z).toBeCloseTo(-10, 3);
    expect(d.eventCamera.insetFrame.distance).toBeLessThan(12);
    expect(d.controls.target.x).toBeCloseTo(22, 3);
  });
  it('follows a departing gang and fits separated riders on a portrait screen', () => {
    const d = fixture('bandits', 390 / 844);
    d.raid.bandits = [actor(-10, -15), actor(22, -15), actor(0, 4)];
    settle(d);
    d.camera.updateMatrixWorld();
    for (const { root } of d.raid.bandits) {
      const p = root.position
        .clone()
        .add(new Vector3(0, 1, 0))
        .project(d.camera);
      expect(Math.abs(p.x)).toBeLessThan(0.85);
      expect(Math.abs(p.y)).toBeLessThan(0.85);
    }
    const previous = d.controls.target.clone();
    d.raid.bandits.forEach((a) => (a.root.position.x += 12));
    settle(d);
    expect(d.controls.target.x - previous.x).toBeCloseTo(12, 2);
  });
  it('keeps the fire inset on the actual target while the squad drives away', () => {
    const d = fixture('workshop-fire');
    settle(d);
    const site = d.eventCamera.insetCamera.position.clone();
    d.raid.crew.forEach((a) => (a.root.visible = false));
    d.raid.vehicle.root.position.set(25, 0, 18);
    settle(d);
    expect(d.controls.target.x).toBeCloseTo(25, 3);
    expect(d.eventCamera.insetCamera.position.equals(site)).toBe(true);
  });
  it('holds both views on pause and removes the inset on skip and reduced motion', () => {
    const d = fixture('bandits');
    settle(d);
    const position = d.camera.position.clone();
    d.paused = true;
    d.motionEnabled = false;
    updateEventCamera(d);
    renderEventInset(d);
    expect(d.camera.position.equals(position)).toBe(true);
    expect(d.eventInsetVisible).toBe(true);
    restoreEventCamera(d);
    expect(d.onEventInset).toHaveBeenLastCalledWith(null);
    expect(d.eventCamera).toBeNull();
    renderEventInset(d);
    expect(d.eventInsetVisible).toBe(false);
  });
  it('restores renderer state even if the second render fails', () => {
    const d = fixture('cargo-theft');
    d.renderer.render.mockImplementation(() => {
      throw new Error('context lost');
    });
    expect(() => renderEventInset(d)).toThrow('context lost');
    expect(d.renderer.setViewport).toHaveBeenLastCalledWith(new Vector4(0, 0, 960, 600));
    expect(d.renderer.setScissor).toHaveBeenLastCalledWith(new Vector4(0, 0, 960, 600));
    expect(d.renderer.setScissorTest).toHaveBeenLastCalledWith(false);
    expect(d.renderer.autoClear).toBe(false);
  });
  it('handles absent patrols, old receipts, and unsupported incident definitions', () => {
    const d = fixture(undefined);
    d.raid.patrol = [];
    settle(d);
    expect(d.onEventInset).toHaveBeenLastCalledWith(
      expect.objectContaining({ label: 'Incident site' }),
    );
    d.raid.event.kind = 'future-incident';
    settle(d);
    expect(d.onEventInset).toHaveBeenLastCalledWith(null);
    expect(d.controls.target.x).toBeCloseTo(PLOTS.blacksmith[0], 3);
    expect(d.camera.position.toArray().every(Number.isFinite)).toBe(true);
  });
  it.each([
    [1440, 900],
    [390, 844],
    [320, 568],
    [844, 390],
  ])('keeps the inset inside a %s × %s canvas', (width, height) => {
    const rect = eventInsetRect(width, height);
    expect(rect.x).toBeGreaterThan(width / 2);
    expect(rect.x + rect.width).toBeLessThan(width);
    expect(rect.y + rect.height + 30).toBeLessThan(height / 2);
    expect(rect.width / rect.height).toBeCloseTo(1.5, 1);
  });
});
