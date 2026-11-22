import { GEM_COLORS } from './SpriteLoader';
import { glyphImage } from './TextGlyphs';

// The arcade feel of ordinary play: how a swap, a landing, a match and a cascade move.
// Everything here is cosmetic and bounded. It adds no waiting to a move beyond CLEAR_RIPPLE,
// never moves a gem off its cell, and does nothing under reduced motion.
// First impact of Phaser's Bounce.easeOut, as a share of the fall.
const FIRST_IMPACT = 1 / 2.75;
/** The longest a match's pops are staggered, in ms: the only time a move gains. */
export const CLEAR_RIPPLE = 48;
// Above this many gems a clear is a bonus sweep with its own effects.
const PLAIN_CLEAR = 12;
const TIER_COLORS = ['#ffffff', '#ffe58a', '#ffb45e', '#ff7fd0', '#9bf3ff'];
/** The colour of a cascade tier's score, hotter as the chain grows. */
export const tierColor = (combo) =>
  TIER_COLORS[Math.min(TIER_COLORS.length, Math.max(1, Math.trunc(combo) || 1)) - 1];
/** How long each gem of a match waits before it pops, rippling out from the first. */
export const clearRipple = (count) =>
  Array.from({ length: Math.max(0, count) }, (_, n) =>
    count > PLAIN_CLEAR ? 0 : Math.min(CLEAR_RIPPLE, n * 12),
  );
/** How many sparks a popped gem throws at this cascade tier. */
export const burstCount = (combo) =>
  Math.min(21, 9 + (Math.max(1, Math.trunc(combo) || 1) - 1) * 3);

export class BoardJuice {
  constructor(animator) {
    this.a = animator;
  }

  get off() {
    return this.a.reducedMotion || !this.a.scene?.add || !this.a.scene.tweens;
  }
  // Decoration runs beside the move, never in its promise chain: a gem released or a board
  // cleared mid-squash simply drops the tween.
  play(config) {
    this.a.touch();
    return this.a.scene.tweens.add(config);
  }

  // The moving gem lifts over its neighbour, which ducks under it.
  swap(lifted, ducked, duration) {
    if (this.off) return;
    const a = this.a;
    a.gemLayer?.bringToTop?.(lifted);
    for (const [sprite, scale] of [
      [lifted, 1.16],
      [ducked, 0.9],
    ])
      this.play({
        targets: sprite,
        scaleX: sprite.scaleX * scale,
        scaleY: sprite.scaleY * scale,
        duration: duration / 2,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
  }

  // A refused swap shakes its head.
  refuse(sprites, duration) {
    if (this.off) return;
    sprites.forEach((sprite, n) =>
      this.play({
        targets: sprite,
        angle: n ? -9 : 9,
        duration: duration / 2,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
        onComplete: () => sprite.setAngle?.(0),
      }),
    );
  }

  // A falling gem flattens as it hits and springs back; a long fall kicks up dust.
  land(sprite, duration, distance) {
    if (this.off || distance < 1) return;
    const a = this.a;
    const depth = Math.min(0.2, 0.08 + distance * 0.03);
    this.play({
      targets: sprite,
      scaleX: sprite.scaleX * (1 + depth * 0.7),
      scaleY: sprite.scaleY * (1 - depth),
      delay: duration * FIRST_IMPACT,
      duration: 70,
      yoyo: true,
      ease: 'Sine.easeOut',
      onStart: () => {
        if (distance >= 3 && sprite.active)
          a.particles?.emitBurst?.(
            { x: sprite.x, y: sprite.y + a.cellSize * 0.4 },
            GEM_COLORS[sprite.__gemType] ?? 0xffffff,
            3,
          );
      },
    });
  }

  // A white flash under each popped gem of an ordinary match.
  flash(p, color) {
    if (this.off) return;
    const a = this.a;
    const glow = a.scene.add
      .circle(p.x, p.y, a.cellSize * 0.34, color ?? 0xffffff, 0.85)
      .setBlendMode('ADD');
    a.effect(glow, { scale: 1.9, alpha: 0, duration: 170, ease: 'Quad.easeOut' });
  }

  // What a match is worth rises out of it, bigger and hotter down a cascade.
  score(points, indices, combo) {
    if (this.off || !(points > 0) || !indices?.length) return;
    const a = this.a;
    const spots = indices.map((index) => a.position(index));
    const x = spots.reduce((sum, p) => sum + p.x, 0) / spots.length,
      y = spots.reduce((sum, p) => sum + p.y, 0) / spots.length;
    const size = Math.round(Math.min(1, 0.42 + combo * 0.07) * a.cellSize);
    const label = glyphImage(a.scene, x, Math.max(a.cellSize * 0.6, y), `+${points}`, {
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      fontSize: `${Math.max(14, size)}px`,
      color: tierColor(combo),
      stroke: '#2a1b3d',
      strokeThickness: 5,
    })
      .setOrigin(0.5)
      .setScale(0.4);
    // It holds, readable, for most of its rise and only then fades.
    a.effect(label, {
      scale: { value: 1, duration: 160, ease: 'Back.easeOut' },
      y: { value: Math.max(a.cellSize * 0.45, y - a.cellSize * 0.9), ease: 'Cubic.easeOut' },
      alpha: { value: 0, delay: 430, duration: 220 },
      duration: 650,
    });
    if (indices.length >= 4 && indices.length <= PLAIN_CLEAR)
      a.ring({ x, y }, 0xffffff, a.cellSize * (1 + indices.length * 0.18));
  }

  // A deep cascade rattles the board a little more with every tier.
  rumble(combo) {
    if (this.off || combo < 3) return;
    const camera = this.a.scene.cameras?.main;
    if (camera?.shakeEffect?.isRunning) return;
    camera?.shake?.(110, Math.min(0.006, 0.002 + combo * 0.0008), true);
  }

  // Gems rain into an opening board column by column instead of sliding half a cell.
  introStart(index) {
    const a = this.a;
    const row = Math.floor(index / a.boardCols),
      col = index % a.boardCols;
    return {
      lift: a.cellSize * (1.2 + (a.boardRows - row) * 0.35),
      delay: Math.min(120, col * 12 + (a.boardRows - 1 - row) * 8),
    };
  }
}
