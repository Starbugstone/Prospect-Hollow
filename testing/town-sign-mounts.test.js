import { expect, it } from 'vitest';
import { Box3, Group, Vector3 } from 'three';
import { TownPrimitives } from '../src/game/town/TownPrimitives';

it('mounts a nameboard flush on the facade above the entrance without ground posts', () => {
  const d = new TownPrimitives();
  const plot = new Group();
  plot.position.set(30, 0.08, -17);
  const wall = d.box(plot, 3.4, 2.5, 2.6, 0, 1.35, 0, '#aa8855');
  d.sign(plot, 'School', 2.8, 0, 3.2, 2.3);
  const board = plot.getObjectByName('Mounted building nameboard');
  plot.updateMatrixWorld(true);
  const wallBox = new Box3().setFromObject(wall);
  const boardBox = new Box3().setFromObject(board);
  expect(board.userData.signMount).toBe('facade');
  expect(boardBox.min.z - wallBox.max.z).toBeCloseTo(0.001);
  expect(boardBox.min.y).toBeGreaterThan(1.5 + plot.position.y);
  expect(plot.getObjectByName('Directory nameboard post')).toBeUndefined();
  d.disposePrimitives();
});

it('grounds an open-site directory at the side, leaving the central entry approach clear', () => {
  const d = new TownPrimitives();
  const plot = new Group();
  d.sign(plot, 'Park', 2.7, 0, 1.15, 2.78);
  const board = plot.getObjectByName('Mounted building nameboard');
  expect(board.userData.signMount).toBe('directory');
  expect(board.position.x + board.scale.x / 2).toBeLessThan(-1.2);
  expect(board.position.z).toBeLessThan(2);
  const posts = [];
  plot.traverse((object) => {
    if (object.name === 'Directory nameboard post') posts.push(object);
  });
  expect(posts).toHaveLength(2);
  for (const post of posts) {
    const bounds = new Box3().setFromObject(post);
    expect(bounds.min.y).toBeCloseTo(0.08);
    expect(bounds.max.y).toBeGreaterThan(board.position.y - 0.215);
    expect(bounds.getSize(new Vector3()).x).toBeCloseTo(0.09);
  }
  d.disposePrimitives();
});

it('uses the visible canopy fascia instead of hiding a board behind an entrance roof', () => {
  const d = new TownPrimitives();
  const plot = new Group();
  d.box(plot, 4, 2.6, 3, 0, 1.4, 0, '#aa8855');
  const canopy = d.box(plot, 4.5, 0.2, 1.4, 0, 2.7, 2.7, '#556677');
  d.sign(plot, 'Concert hall', 3, 0, 3.2, 2);
  const board = plot.getObjectByName('Mounted building nameboard');
  const front = new Box3().setFromObject(canopy).max.z;
  const boardBounds = new Box3().setFromObject(board);
  expect(board.userData.signMount).toBe('facade');
  expect(boardBounds.min.z).toBeGreaterThanOrEqual(front);
  expect(boardBounds.min.y).toBeGreaterThan(2.1);
  d.disposePrimitives();
});
