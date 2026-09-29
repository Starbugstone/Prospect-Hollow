import { FUSION_STYLES } from '../engine/BonusFusion';
import { emitFusionDebris, playFusionPayload } from './FusionPayloadEffects';

const SPECTRUM = [0xff718f, 0xffc75b, 0x9bffbe, 0x72edff, 0xb39aff, 0xff8ae9];

export function describeBonusCombo(step, effects) {
  const pair = step.bonusSwap;
  if (
    pair?.length !== 2 ||
    pair[0].index === pair[1].index ||
    !pair.every((item) =>
      effects.some((effect) => effect.index === item.index && effect.type === item.type),
    )
  )
    return null;
  const key = pair
    .map(({ type }) => type)
    .sort()
    .join('+');
  const payload = step.bonusFusion ?? step.matches?.find((match) => match.fusion)?.fusion;
  return FUSION_STYLES[key]
    ? {
        ...FUSION_STYLES[key],
        ...payload,
        key,
        pair,
        targets: payload?.targets ?? step.cleared,
        clearedCount: step.cleared.length,
      }
    : null;
}

// A real two-special swap gets its own anticipation, collision and release.
// All objects use the animator's cancellation and cosmetic budgets.
export class BonusComboEffects {
  constructor(bonuses) {
    this.b = bonuses;
    this.a = bonuses.a;
  }

  async play(combo, effects) {
    const a = this.a;
    const color = `#${combo.color.toString(16).padStart(6, '0')}`;
    const announce = () =>
      a.onBanner?.({
        label: combo.label,
        color,
        kind: 'fusion',
        types: combo.pair.map(({ type }) => type),
        detail: combo.detail,
        clearedCount: combo.clearedCount,
      });
    if (a.reducedMotion) {
      announce();
      [...new Set(combo.pair.map(({ type }) => type))].forEach((type) => this.b.sound(type));
      return;
    }
    const generation = a.generation;
    const points = combo.pair.map(({ index }) => a.position(index));
    const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    announce();
    a.audio?.playArcadeCue?.('fusion-charge');
    this.charge(combo, center, points);
    await a.tween({ phase: 0 }, { phase: 1, duration: 460 });
    if (generation !== a.generation) return;

    // A compact, bright collision hangs for a beat before the board-wide release.
    this.star(center, combo.color, a.cellSize * 1.4, 170);
    await a.tween({ phase: 0 }, { phase: 1, duration: 90 });
    if (generation !== a.generation) return;

    this.release(combo, center);
    const pairIndices = new Set(combo.pair.map(({ index }) => index));
    const chain = effects.filter(({ index }) => !pairIndices.has(index)).slice(0, 2);
    [...new Set(combo.pair.map(({ type }) => type))].forEach((type) => this.b.sound(type));
    a.audio?.playArcadeCue?.('fusion-impact');
    a.onImpact?.({ type: 'bonus-fusion', color });
    a.scene.cameras.main.shake(420, 0.016, true);
    await playFusionPayload(a, combo, center);
    if (generation !== a.generation) return;
    chain.forEach((effect) => this.b.impact(effect));
    // The second thump is the armor-breaking hit; debris continues into gravity.
    a.audio?.playArcadeCue?.('fusion-aftershock');
    a.onImpact?.({ type: 'bonus-fusion', color });
    a.scene.cameras.main.shake(190, 0.009, true);
    this.star(center, combo.accent, a.cellSize * 2.8, 360);
  }

  charge(combo, center, points) {
    const a = this.a,
      size = a.cellSize;
    const width = a.boardCols * size,
      height = a.boardRows * size;
    const shade = a.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x08051c, 0.72)
      .setAlpha(0);
    a.effect(shade, { alpha: 1, duration: 170, hold: 210, yoyo: true, ease: 'Sine.easeInOut' });

    for (let i = 0; i < 3; i++) {
      const orbit = a.scene.add.graphics({ x: center.x, y: center.y }).setBlendMode('ADD');
      orbit.lineStyle(size * 0.035, i % 2 ? combo.accent : combo.color, 0.9);
      for (let j = 0; j < 4; j++) {
        const angle = (j * Math.PI) / 2;
        orbit
          .beginPath()
          .arc(0, 0, size * (1.6 + i * 0.55), angle, angle + 1.05)
          .strokePath();
      }
      a.effect(orbit, {
        scale: 0.12,
        rotation: (i % 2 ? -1 : 1) * 2.4,
        alpha: 0,
        duration: 530,
        ease: 'Cubic.easeIn',
      });
    }

    const energy = a.scene.add.graphics({ x: center.x, y: center.y }).setBlendMode('ADD');
    for (let i = 0; i < 28; i++) {
      const angle = (i * Math.PI * 2) / 28;
      const radius = size * (2.6 + (i % 3) * 0.5);
      energy.lineStyle(i % 3 === 0 ? 3 : 1, i % 2 ? combo.color : combo.accent, 0.8);
      energy.lineBetween(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        Math.cos(angle) * (radius + size),
        Math.sin(angle) * (radius + size),
      );
    }
    a.effect(energy, {
      scale: 0.03,
      rotation: 0.22,
      alpha: 0,
      duration: 460,
      ease: 'Cubic.easeIn',
    });

    combo.pair.forEach(({ type }, i) => {
      const icon = this.b.icon(type, points[i], size * 1.45);
      const startAngle = Math.atan2(points[i].y - center.y, points[i].x - center.x);
      a.effect(icon, {
        x: center.x,
        y: center.y,
        scaleX: icon.scaleX * 1.25,
        scaleY: icon.scaleY * 1.25,
        angle: i ? 155 : -155,
        duration: 460,
        ease: 'Cubic.easeIn',
        onUpdate: (tween) => {
          const t = tween.progress;
          const radius = (size * 0.5 + Math.sin(t * Math.PI) * size * 1.35) * (1 - t);
          const angle = startAngle + t * Math.PI * 1.6;
          icon.setPosition(
            center.x + Math.cos(angle) * radius,
            center.y + Math.sin(angle) * radius,
          );
        },
      });
    });
  }

  star(p, color, radius, duration) {
    const a = this.a;
    const star = a.scene.add.graphics({ x: p.x, y: p.y }).setBlendMode('ADD');
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      star.fillStyle(i % 2 ? color : 0xffffff, 0.95);
      star.fillTriangle(
        Math.cos(angle - 0.45) * radius * 0.12,
        Math.sin(angle - 0.45) * radius * 0.12,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        Math.cos(angle + 0.45) * radius * 0.12,
        Math.sin(angle + 0.45) * radius * 0.12,
      );
    }
    star.setScale(0.35);
    a.effect(star, { scale: 1.25, alpha: 0, duration, ease: 'Cubic.easeOut' });
  }

  release(combo, center) {
    const a = this.a,
      size = a.cellSize;
    const width = a.boardCols * size,
      height = a.boardRows * size;
    const rainbow = combo.key.includes('rainbow');
    const colors = rainbow ? SPECTRUM : [combo.color, combo.accent, 0xfff4d4];
    this.b.highlightTargets(combo.targets, combo.color);
    this.b.boardBurst(combo.color);
    emitFusionDebris(a, combo, center);

    // Expanding segmented shockwaves keep a crisp silhouette around the bright core.
    const reach = Math.hypot(width, height) * 0.72;
    for (let i = 0; i < 4; i++) {
      const ring = a.scene.add.graphics({ x: center.x, y: center.y }).setBlendMode('ADD');
      for (let segment = 0; segment < 12; segment++) {
        const angle = (segment * Math.PI) / 6;
        ring.lineStyle(size * (i === 0 ? 0.12 : 0.045), colors[segment % colors.length], 0.9);
        ring
          .beginPath()
          .arc(0, 0, reach, angle, angle + 0.48)
          .strokePath();
      }
      ring.setScale(0.025);
      a.effect(ring, {
        scale: 1,
        alpha: { value: 0, ease: 'Cubic.easeIn' },
        rotation: i % 2 ? 0.35 : -0.35,
        delay: i * 65,
        duration: 800,
        ease: 'Cubic.easeOut',
      });
    }
    this.star(center, combo.accent, size * 4.5, 650);

    const rays = a.scene.add.graphics({ x: center.x, y: center.y }).setBlendMode('ADD');
    for (let i = 0; i < 36; i++) {
      const angle = (i * Math.PI) / 18;
      const radius = reach * (0.5 + (i % 4) * 0.14);
      rays.fillStyle(colors[i % colors.length], i % 3 ? 0.35 : 0.75);
      rays.fillTriangle(
        Math.cos(angle - 0.008) * size,
        Math.sin(angle - 0.008) * size,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        Math.cos(angle + 0.008) * size,
        Math.sin(angle + 0.008) * size,
      );
    }
    rays.setScale(0.2);
    a.effect(rays, { scale: 1.2, alpha: 0, duration: 760, ease: 'Cubic.easeOut' });

    // Secondary sparks land only on tiles the resolution actually clears.
    const stride = Math.max(1, Math.ceil(combo.targets.length / 16));
    combo.targets
      .filter((_, i) => i % stride === 0)
      .forEach((index, i) => {
        const p = a.position(index);
        const spark = a.scene.add
          .image(p.x, p.y, 'spark')
          .setDisplaySize(size * 0.8, size * 0.8)
          .setTint(colors[i % colors.length])
          .setBlendMode('ADD');
        a.effect(spark, {
          scaleX: 0,
          scaleY: 0,
          angle: 100,
          alpha: 0,
          delay: (Math.hypot(p.x - center.x, p.y - center.y) / size) * 22,
          duration: 620,
          ease: 'Cubic.easeIn',
        });
      });
    a.particles?.emitExplosion(center, { color: combo.color, count: 72 });
  }
}
