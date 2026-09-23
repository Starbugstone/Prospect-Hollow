import { t } from '../../i18n';
import { BONUS_TYPES } from './SpriteLoader';
import { BonusComboEffects, describeBonusCombo } from './BonusComboEffects';

const RAINBOW = [0xff658c, 0xffc85b, 0xffffad, 0x74ffc3, 0x7defff, 0xa39aff, 0xf293ff];
const POWER_COLOR = {
  bomb: 0xffbb64,
  tnt: 0xff7655,
  rainbow: 0xe0afff,
  color_wand: 0xe0afff,
  cross: 0x93efff,
  tile_breaker: 0x93efff,
  clear_row: 0x93efff,
};

// Descriptors preserve the actual origin and affected cells, including toolbar powers.
export function describeBonusEffects(step, typeAt) {
  const primary = step.bonusEffect
    ? [
        {
          type: step.bonusEffect.type,
          index: step.bonusEffect.originIndex,
          targets: step.cleared,
        },
      ]
    : [];
  const activated = new Set(
    (step.matches ?? [])
      .filter((match) => step.bonusEffect || match.type === 'bonus-activation')
      .flatMap((match) => match.indices),
  );
  return [
    ...primary,
    ...step.cleared.flatMap((index) => {
      const type = typeAt(index);
      return activated.has(index) && BONUS_TYPES.includes(type)
        ? [{ type, index, targets: step.cleared }]
        : [];
    }),
  ];
}

export class BonusEffects {
  constructor(animator) {
    this.a = animator;
  }

  async play(step) {
    const a = this.a;
    const effects = describeBonusEffects(
      step,
      (index) => a.gemSprites.get(a.indexToGemId[index])?.__gemType,
    );
    if (!effects.length) return;
    const combo = describeBonusCombo(step, effects);
    if (combo) {
      await new BonusComboEffects(this).play(combo, effects);
      return;
    }
    if (a.reducedMotion) {
      this.sound(effects[0].type);
      return;
    }
    const generation = a.generation;
    const primary = effects[0];
    const color = POWER_COLOR[primary.type];
    this.highlightTargets(primary.targets, color);
    // A short wind-up gives a special its weight. Cosmetic tails run alongside gravity.
    effects.slice(0, 6).forEach((effect) => this.charge(effect));
    await a.tween({ phase: 0 }, { phase: 1, duration: 230 });
    if (generation !== a.generation) return;
    effects.slice(0, 6).forEach((effect) => this.impact(effect));
    a.onImpact?.({ type: primary.type, color: `#${color.toString(16).padStart(6, '0')}` });
    this.boardBurst(color);
    const labels = {
      bomb: 'BOOM!',
      tnt: 'BOOM!',
      rainbow: 'RAINBOW RUSH!',
      color_wand: 'COLOR RUSH!',
      cross: 'CROSS FIRE!',
      tile_breaker: 'CROSS FIRE!',
      clear_row: 'ROW ROCKET!',
    };
    this.callout(
      effects.length > 1
        ? t('CHAIN REACTION ×{count}', { count: effects.length })
        : t(labels[primary.type]),
      a.position(primary.index),
      color,
    );
    await a.tween({ phase: 0 }, { phase: 1, duration: 160 });
  }

  icon(type, position, size) {
    const a = this.a;
    const texture = a.textures[type] ?? { key: `power-${type.replaceAll('_', '-')}` };
    return a.scene.add
      .image(position.x, position.y, texture.key, texture.frame)
      .setDisplaySize(size, size);
  }

  charge({ type, index }) {
    const a = this.a;
    const p = a.position(index);
    const size = a.cellSize;
    const icon = this.icon(type, p, size * 1.5);
    const pull = a.scene.add.graphics({ x: p.x, y: p.y }).setBlendMode('ADD');
    pull.lineStyle(3, POWER_COLOR[type], 0.75);
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      pull.lineBetween(
        Math.cos(angle) * size * 1.3,
        Math.sin(angle) * size * 1.3,
        Math.cos(angle) * size * 3.4,
        Math.sin(angle) * size * 3.4,
      );
    }
    a.effect(pull, { scale: 0.05, rotation: 0.3, alpha: 0, duration: 230, ease: 'Cubic.easeIn' });
    if (type === 'tnt') {
      icon.setPosition(p.x, p.y - size * 1.2).setAngle(-12);
      a.effect(icon, { x: p.x, y: p.y, angle: 0, duration: 230, ease: 'Cubic.easeIn' });
    } else {
      a.effect(icon, {
        scaleX: icon.scaleX * 2.2,
        scaleY: icon.scaleY * 2.2,
        alpha: 0,
        duration: 390,
        ease: 'Cubic.easeOut',
      });
    }
    const ring = a.scene.add
      .circle(p.x, p.y, size * 0.9, 0, 0)
      .setStrokeStyle(3, POWER_COLOR[type], 0.95)
      .setBlendMode('ADD');
    a.effect(ring, { scale: 0.25, alpha: 0, duration: 230, ease: 'Quad.easeIn' });
  }

  sound(type) {
    const audio = this.a.audio;
    if (type === 'bomb' || type === 'tnt') audio?.playBomb?.();
    else if (type === 'rainbow' || type === 'color_wand') audio?.playRainbowLaser?.();
    else audio?.playCrossFire?.();
  }

  impact({ type, index, targets }) {
    const a = this.a;
    const p = a.position(index);
    this.sound(type);
    if (type === 'bomb' || type === 'tnt') this.explosion(p);
    else if (type === 'rainbow' || type === 'color_wand') this.rainbow(p, targets);
    else this.cross(p, type === 'clear_row');
  }

  highlightTargets(indices, color) {
    const a = this.a;
    const art = a.scene.add.graphics();
    art.fillStyle(color, 0.18).lineStyle(2, color, 0.6);
    for (const index of indices) {
      const p = a.position(index),
        size = a.cellSize - 4;
      art.fillRoundedRect(p.x - size / 2, p.y - size / 2, size, size, 5);
      art.strokeRoundedRect(p.x - size / 2, p.y - size / 2, size, size, 5);
    }
    a.effect(art, { alpha: 0, duration: 440, ease: 'Cubic.easeIn' });
  }

  boardBurst(color) {
    const a = this.a;
    const width = a.boardSize * a.cellSize,
      height = a.boardRows * a.cellSize;
    const wash = a.scene.add
      .rectangle(width / 2, height / 2, width, height, color, 0.17)
      .setBlendMode('ADD');
    a.effect(wash, { alpha: 0, duration: 520, ease: 'Cubic.easeOut' });
    const border = a.scene.add
      .rectangle(width / 2, height / 2, width - 8, height - 8)
      .setStrokeStyle(8, color, 0.8)
      .setBlendMode('ADD');
    a.effect(border, { alpha: 0, duration: 640, ease: 'Cubic.easeOut' });
    a.scene.cameras.main.shake(220, 0.007);
  }

  explosion(p) {
    const a = this.a,
      size = a.cellSize;
    const glow = a.scene.add
      .circle(p.x, p.y, size * 2.6, 0xffa748, 0.45)
      .setScale(0.1)
      .setBlendMode('ADD');
    a.effect(glow, { scale: 1.8, alpha: 0, duration: 800, ease: 'Cubic.easeOut' });
    for (const [color, delay, radius] of [
      [0xffffd4, 0, 2.4],
      [0xff9f42, 60, 4],
      [0xffe5a6, 110, 3.3],
    ]) {
      const ring = a.scene.add
        .circle(p.x, p.y, size * radius, 0, 0)
        .setStrokeStyle(size * 0.12, color)
        .setScale(0.08)
        .setBlendMode('ADD');
      a.effect(ring, { scale: 1, alpha: 0, delay, duration: 800, ease: 'Cubic.easeOut' });
    }
    const rays = a.scene.add.graphics({ x: p.x, y: p.y }).setBlendMode('ADD');
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI) / 12;
      const distance = size * (i % 2 ? 2.8 : 4.6);
      rays.fillStyle(i % 2 ? 0xffb455 : 0xffefb0, 0.9);
      rays.fillTriangle(
        Math.cos(angle - 0.08) * size * 0.3,
        Math.sin(angle - 0.08) * size * 0.3,
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        Math.cos(angle + 0.08) * size * 0.3,
        Math.sin(angle + 0.08) * size * 0.3,
      );
    }
    rays.setScale(0.12);
    a.effect(rays, { scale: 1, alpha: 0, angle: 12, duration: 700, ease: 'Cubic.easeOut' });
    a.particles?.emitExplosion(p, { color: 0xffc667, count: 72 });
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const ember = a.scene.add
        .circle(p.x, p.y, size * 0.11, i % 2 ? 0xffdf7a : 0xff6c41)
        .setBlendMode('ADD');
      a.effect(ember, {
        x: p.x + Math.cos(angle) * size * 3.6,
        y: p.y + Math.sin(angle) * size * 3.6,
        scale: 0.1,
        alpha: 0,
        duration: 720,
        ease: 'Cubic.easeOut',
      });
    }
  }

  cross(p, rowOnly = false) {
    const a = this.a;
    const edges = [
      { x: 0, y: p.y },
      { x: a.boardSize * a.cellSize, y: p.y },
    ];
    if (!rowOnly) edges.push({ x: p.x, y: 0 }, { x: p.x, y: a.boardRows * a.cellSize });
    edges.forEach((end, i) => {
      const angle = Math.atan2(end.y - p.y, end.x - p.x);
      const distance = Math.hypot(end.x - p.x, end.y - p.y);
      const color = i < 2 ? 0x81efff : 0xc9b2ff;
      for (const [width, alpha] of [
        [a.cellSize * 0.95, 0.28],
        [a.cellSize * 0.34, 0.8],
        [a.cellSize * 0.085, 1],
      ]) {
        const beam = a.scene.add
          .rectangle(p.x, p.y, distance, width, color, alpha)
          .setOrigin(0, 0.5)
          .setRotation(angle)
          .setScale(0.03, 1)
          .setBlendMode('ADD');
        a.effect(beam, { scaleX: 1, alpha: 0, duration: 570, ease: 'Cubic.easeOut' });
      }
      const tip = a.scene.add
        .triangle(p.x, p.y, 0, 0, -20, -10, -20, 10, 0xf3ffff)
        .setRotation(angle)
        .setBlendMode('ADD');
      a.effect(tip, { x: end.x, y: end.y, alpha: 0, duration: 410, ease: 'Quad.easeOut' });
    });
    a.ring(p, 0xd9faff, a.cellSize * 3);
    edges.forEach((end) => a.particles?.emitExplosion(end, { color: 0x9effff, count: 20 }));
    a.particles?.emitExplosion(p, { color: 0xaeedff, count: 48 });
  }

  rainbow(p, targets) {
    const a = this.a,
      size = a.cellSize;
    const orbit = a.scene.add.graphics({ x: p.x, y: p.y }).setBlendMode('ADD');
    RAINBOW.forEach((color, i) =>
      orbit
        .lineStyle(7, color, 0.9)
        .beginPath()
        .arc(0, 0, size * 0.85, (i * Math.PI * 2) / 7, ((i + 0.75) * Math.PI * 2) / 7)
        .strokePath(),
    );
    a.effect(orbit, { rotation: 3.5, scale: 3, alpha: 0, duration: 800, ease: 'Cubic.easeOut' });
    // Cap lightning paths; every affected cell is still highlighted and cleared.
    const visibleTargets = targets.filter(
      (_, i) => i % Math.max(1, Math.ceil(targets.length / 24)) === 0,
    );
    visibleTargets.forEach((index, order) => {
      const end = a.position(index);
      if (Math.hypot(end.x - p.x, end.y - p.y) < 1) return;
      const color = RAINBOW[order % RAINBOW.length];
      const dx = end.x - p.x,
        dy = end.y - p.y,
        length = Math.hypot(dx, dy);
      const points = Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        const offset =
          i === 0 || i === 6 ? 0 : (i % 2 ? 1 : -1) * size * (0.08 + (order % 3) * 0.04);
        return {
          x: p.x + dx * t - (dy / length) * offset,
          y: p.y + dy * t + (dx / length) * offset,
        };
      });
      const bolt = a.scene.add.graphics().setBlendMode('ADD');
      for (const [width, alpha] of [
        [16, 0.28],
        [6, 0.9],
        [2, 1],
      ]) {
        bolt
          .lineStyle(width, width === 2 ? 0xffffff : color, alpha)
          .beginPath()
          .moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => bolt.lineTo(point.x, point.y));
        bolt.strokePath();
      }
      a.effect(bolt, {
        alpha: 0,
        delay: (order % 4) * 20,
        duration: 650 + (order % 3) * 70,
        ease: 'Cubic.easeIn',
      });
      a.particles?.emitBurst(end, color, 8);
      a.ring(end, color, size * 0.6);
    });
    a.ring(p, 0xf6d3ff, size * 2.3);
  }

  callout(label, p, color) {
    if (!label) return;
    this.a.onBanner?.({ label, color: `#${color.toString(16).padStart(6, '0')}` });
  }

  created(gem, index) {
    const a = this.a;
    // Still let the new piece register visually when decorative motion is disabled.
    if (a.reducedMotion) return a.tween({ phase: 0 }, { phase: 1, duration: 120 });
    const p = a.position(index);
    a.ring(p, POWER_COLOR[gem.type], a.cellSize);
    a.particles?.emitBurst(p, POWER_COLOR[gem.type], 28);
    this.callout(
      gem.type === 'bomb'
        ? 'BOMB READY!'
        : gem.type === 'rainbow'
          ? 'RAINBOW READY!'
          : 'CROSS FIRE READY!',
      p,
      POWER_COLOR[gem.type],
    );
    const icon = this.icon(gem.type, p, a.cellSize * 0.4);
    return a.effect(icon, {
      scaleX: icon.scaleX * 3.2,
      scaleY: icon.scaleY * 3.2,
      alpha: 0,
      duration: 400,
      ease: 'Back.easeOut',
    });
  }

  shuffle() {
    const a = this.a;
    if (a.reducedMotion) return;
    const p = { x: (a.boardSize * a.cellSize) / 2, y: (a.boardRows * a.cellSize) / 2 };
    const swirl = a.scene.add.graphics({ x: p.x, y: p.y }).setBlendMode('ADD');
    for (let i = 0; i < 5; i++)
      swirl
        .lineStyle(3, i % 2 ? 0x9fffdf : 0xcfb0ff, 0.8)
        .beginPath()
        .arc(0, 0, a.cellSize * (0.6 + i * 0.4), i, i + Math.PI * 1.3)
        .strokePath();
    a.effect(swirl, {
      rotation: Math.PI,
      scale: 1.3,
      alpha: 0,
      duration: 550,
      ease: 'Cubic.easeOut',
    });
    const icon = this.icon('shuffle', p, a.cellSize * 1.5);
    a.effect(icon, { rotation: Math.PI, alpha: 0, duration: 500, ease: 'Cubic.easeIn' });
    this.callout('REMIX!', p, 0x9fffdf);
  }
}
