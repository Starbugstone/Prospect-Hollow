import { spriteRef } from './spriteRefs';
import { t } from '../../i18n';
import { GEM_COLORS } from './SpriteLoader';
import { GEM_TYPES } from '../engine/GemFactory';
import { CORE_CHARGES } from '../engine/ChapterMechanics';
import { gemTexture } from '../../data/gemAppearance';
import { CHAPTERS } from '../../data/campaign';
import { chapterIndexOf } from '../../data/chapters';
import { mineSignalAppearance, mineRelicAppearance } from '../../data/mineThemes';
import { BonusEffects } from './BonusEffects';
import { isPlayableCell, gravityDestination } from '../engine/BoardTopology';
import { boardEdges, fallWaypoints } from './BoardGeometry';
import { glyphImage } from './TextGlyphs';
import {
  cascadeTier,
  simultaneousMatchCount,
  multiMatchLabel,
  tierCoins,
  MULTI_MATCH_COIN_STEP,
} from '../engine/MatchRewards';

const MOTION = Object.freeze({ swap: 115, reject: 75, clear: 90, fall: 190, intro: 160 });
// Lit lanterns and spent charge cores leave the board; lit survey markers and
// fired spore relays keep their check mark.
const VANISHING_SIGNALS = new Set(['lantern', 'core']);
const CRACKS = [
  [
    [88, 10],
    [67, 55],
    [87, 75],
    [62, 108],
    [81, 151],
  ],
  [
    [87, 75],
    [123, 65],
    [150, 83],
  ],
  [
    [65, 105],
    [31, 98],
    [10, 113],
  ],
];

// Obstacle art: special casings first, then stone or ice by damage.
export function tileTexture(tile, { damaged = false, frozen = false } = {}) {
  if (tile?.rootKnot) return 'tile-root-knot';
  if (tile?.fossilGroup != null) return tile.bonusOnly ? 'tile-fossil-casing' : 'tile-dust';
  if (tile?.bonusOnly) return 'tile-blast-gate';
  if (tile?.type === 'blocker')
    return damaged ? 'block-cracked' : tile.health > 1 ? 'block-reinforced' : 'block-stone';
  return damaged && !frozen ? 'ice-cracked' : 'ice-frost';
}
const sameTile = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

export class BoardAnimator {
  constructor({
    scene,
    boardContainer,
    backgroundLayer,
    tileLayer,
    gemLayer,
    fxLayer,
    textures,
    particles,
    audio,
    settings,
    onImpact,
    onBanner,
    onActivity,
  }) {
    Object.assign(this, {
      scene,
      boardContainer,
      backgroundLayer,
      tileLayer,
      gemLayer,
      fxLayer,
      textures,
      particles,
      audio,
      settings,
      onImpact,
      onBanner,
      onActivity,
    });
    this.bonuses = new BonusEffects(this);
    this.iceSprites = new Map();
    this.fossilSprites = new Map();
    this.tileOverlays = new Map();
    this.gemSprites = new Map();
    this.cellHighlights = new Map();
    this.indexToGemId = [];
    this.tiles = [];
    this.markers = new Map();
    this.effects = new Set();
    this.pending = new Set();
    // Cleared gems return here and are reused by refills instead of being recreated.
    this.gemPool = [];
    this.generation = 0;
    this.cellSize = 0;
    this.boardCols = 0;
    this.boardRows = 0;
  }

  get reducedMotion() {
    return this.settings?.reducedMotion ?? false;
  }
  get theme() {
    const level = this.levelId ?? 1;
    if (this.themeLevel !== level) {
      this.themeLevel = level;
      this.themeId = CHAPTERS[chapterIndexOf(level)]?.theme;
    }
    return this.themeId;
  }
  setAudioManager(audio) {
    this.audio = audio;
  }

  // Something on the board is about to change; a sleeping game loop must draw it.
  touch() {
    this.onActivity?.();
  }

  // Whether any motion still needs frames (see BoardLoop).
  isAnimating() {
    if (this.pending.size || this.scene?.tweens?.getTweens?.().length) return true;
    if (this.particles?.alive?.() || this.scene?.cameras?.main?.shakeEffect?.isRunning) return true;
    for (const sprite of this.gemSprites.values()) if (sprite.anims?.isPlaying) return true;
    return false;
  }

  // Cancellation settles all pending promises, including when a level is exited mid-fall.
  clear() {
    this.touch();
    this.generation++;
    for (const cancel of [...this.pending]) cancel();
    this.clearMarkers();
    this.gemSprites.forEach((sprite) => sprite.destroy());
    this.gemSprites.clear();
    this.gemPool.forEach((sprite) => sprite.destroy());
    this.gemPool = [];
    this.indexToGemId = [];
    this.backgroundLayer?.removeAll?.(true);
    this.tileLayer?.removeAll?.(true);
    this.tileOverlays.clear();
    this.cellHighlights.clear();
    this.iceSprites.clear();
    this.fossilSprites.clear();
    this.rootLinks = null;
    this.rootLinksKey = '';
    this.boardOutline = null;
    this.boardOutlineKey = '';
    this.effects.forEach((effect) => effect.destroy());
    this.effects.clear();
    this.particles?.clear?.();
    this.scene?.cameras?.main?.resetFX();
  }
  destroy() {
    this.clear();
  }

  tween(targets, config) {
    if (!this.scene?.tweens) return Promise.resolve();
    this.touch();
    return new Promise((resolve) => {
      let tween;
      const finish = () => {
        this.pending.delete(cancel);
        resolve();
      };
      const cancel = () => {
        tween?.remove();
        finish();
      };
      this.pending.add(cancel);
      tween = this.scene.tweens.add({ targets, ...config, onComplete: finish, onStop: finish });
    });
  }

  position(index) {
    return {
      x: ((index % this.boardCols) + 0.5) * this.cellSize,
      y: (Math.floor(index / this.boardCols) + 0.5) * this.cellSize,
    };
  }

  setLayout({ boardCols, boardRows, cellSize }) {
    this.touch();
    const changed =
      boardCols !== this.boardCols || boardRows !== this.boardRows || cellSize !== this.cellSize;
    Object.assign(this, { boardCols, boardRows, cellSize });
    if (!changed || !this.scene?.add) return;
    this.drawCells();
    this.indexToGemId.forEach((id, index) => {
      const sprite = this.gemSprites.get(id);
      if (sprite) {
        const p = this.position(index);
        sprite.setPosition(p.x, p.y).setDisplaySize(cellSize * 0.88, cellSize * 0.88);
      }
    });
    for (const [key, { indices, color }] of [...this.markers])
      key === 'hint' ? this.showHintMove(indices) : this.showMarkers(key, indices, color);
  }

  reset(board, layout) {
    this.clear();
    Object.assign(this, {
      boardCols: layout.boardCols,
      boardRows: layout.boardRows,
      cellSize: layout.cellSize,
    });
    if (!this.scene?.add) return;
    this.drawCells();
    this.syncToBoard(board);
  }

  createGem(gem, index) {
    const p = this.position(index);
    let sprite = this.gemPool.pop();
    if (sprite) {
      sprite.setActive(true).setVisible(true).setPosition(p.x, p.y).setAlpha(1).setAngle(0);
    } else {
      const texture = this.textures[gem.type] ?? this.textures.ruby;
      sprite = this.scene.add.sprite(p.x, p.y, texture.key, texture.frame);
      this.gemLayer.add(sprite);
    }
    this.configureGem(sprite, gem.type);
    this.gemSprites.set(gem.id, sprite);
    return sprite;
  }

  // A cleared gem keeps its place in the gem layer, hidden, until a refill needs it.
  releaseGem(id) {
    const sprite = this.gemSprites.get(id);
    if (!sprite) return;
    this.gemSprites.delete(id);
    if (!sprite.setActive || this.gemPool.length >= this.boardCols * this.boardRows) {
      sprite.destroy();
      return;
    }
    this.scene?.tweens?.killTweensOf?.(sprite);
    sprite.anims?.stop();
    sprite.setActive(false).setVisible(false);
    this.gemPool.push(sprite);
  }

  configureGem(sprite, type) {
    this.touch();
    const texture = GEM_TYPES.includes(type)
      ? spriteRef(gemTexture(type, this.levelId), this.scene?.textures)
      : type === 'relic' && mineRelicAppearance(this.theme).texture !== 'gem-relic'
        ? spriteRef(mineRelicAppearance(this.theme).texture, this.scene?.textures)
        : (this.textures[type] ?? this.textures.ruby);
    sprite.anims?.stop();
    sprite.setTexture(texture.key, texture.frame);
    sprite.__gemType = type;
    if (texture.animation && !this.reducedMotion) sprite.play(texture.animation);
    sprite.setDisplaySize(this.cellSize * 0.88, this.cellSize * 0.88);
  }

  syncBonusMotion() {
    const hint = this.markers.get('hint');
    if (hint) this.showHintMove(hint.indices);
    this.gemSprites.forEach((sprite) => {
      if (this.textures[sprite.__gemType]?.animation) this.configureGem(sprite, sprite.__gemType);
    });
  }

  syncToBoard(board) {
    if (!this.scene?.add) return;
    this.touch();
    const seen = new Set();
    this.indexToGemId = board.map((gem, index) => {
      if (!gem) return null;
      seen.add(gem.id);
      const sprite = this.gemSprites.get(gem.id) ?? this.createGem(gem, index);
      const p = this.position(index);
      sprite
        .setPosition(p.x, p.y)
        .setAlpha(1)
        .setDisplaySize(this.cellSize * 0.88, this.cellSize * 0.88);
      if (sprite.__gemType !== gem.type) {
        this.configureGem(sprite, gem.type);
      }
      return gem.id;
    });
    for (const id of [...this.gemSprites.keys()]) if (!seen.has(id)) this.releaseGem(id);
  }

  async playIntroCascade() {
    if (!this.scene?.add || this.reducedMotion) return;
    await Promise.all(
      this.indexToGemId.map((id, index) => {
        const sprite = this.gemSprites.get(id);
        if (!sprite) return;
        const p = this.position(index);
        sprite.y -= this.cellSize * 0.5;
        sprite.alpha = 0.6;
        return this.tween(sprite, {
          y: p.y,
          alpha: 1,
          delay: Math.min(
            90,
            (index % this.boardCols) * 7 + Math.floor(index / this.boardCols) * 4,
          ),
          duration: MOTION.intro,
          ease: 'Back.easeOut',
        });
      }),
    );
  }

  async animateSwap({ aIndex, bIndex }) {
    const generation = this.generation;
    const a = this.gemSprites.get(this.indexToGemId[aIndex]);
    const b = this.gemSprites.get(this.indexToGemId[bIndex]);
    if (!a || !b) return;
    await Promise.all([
      this.tween(a, { ...this.position(bIndex), duration: MOTION.swap, ease: 'Cubic.easeOut' }),
      this.tween(b, { ...this.position(aIndex), duration: MOTION.swap, ease: 'Cubic.easeOut' }),
    ]);
    if (generation !== this.generation) return;
    [this.indexToGemId[aIndex], this.indexToGemId[bIndex]] = [
      this.indexToGemId[bIndex],
      this.indexToGemId[aIndex],
    ];
  }

  async animateInvalidSwap({ aIndex, bIndex }) {
    const a = this.gemSprites.get(this.indexToGemId[aIndex]);
    const b = this.gemSprites.get(this.indexToGemId[bIndex]);
    if (!a || !b) return;
    await Promise.all([
      this.tween(a, {
        ...this.position(bIndex),
        duration: MOTION.reject,
        yoyo: true,
        ease: 'Sine.easeInOut',
      }),
      this.tween(b, {
        ...this.position(aIndex),
        duration: MOTION.reject,
        yoyo: true,
        ease: 'Sine.easeInOut',
      }),
    ]);
  }

  async animateShuffle(board) {
    const generation = this.generation;
    this.bonuses.shuffle();
    const sprites = [...this.gemSprites.values()];
    await this.tween(sprites, { alpha: 0.15, duration: 100 });
    if (generation !== this.generation) return;
    this.syncToBoard(board);
    sprites.forEach((sprite) => sprite.setAlpha(0.15));
    await this.tween(sprites, { alpha: 1, duration: 150 });
  }

  async playSteps(steps) {
    if (!this.scene?.add) return;
    const generation = this.generation;
    for (let i = 0; i < steps.length; i++) {
      if (generation !== this.generation) return;
      const step = steps[i];
      if (step.cleared?.length) {
        const combo = cascadeTier(step, i);
        this.audio?.playMatch?.({ comboCount: combo });
        if (combo > 1) this.celebrate(combo);
        const matchCount = simultaneousMatchCount(step);
        if (matchCount >= 2) {
          this.onBanner?.({
            kind: 'multi-match',
            label: multiMatchLabel(matchCount),
            color: '#8bf7ff',
            count: matchCount,
            coins: tierCoins(matchCount, MULTI_MATCH_COIN_STEP),
          });
          this.audio?.playArcadeCue?.('reward', Math.min(matchCount, 5));
        }
      }
      await this.bonuses.play(step);
      await this.playSporeBursts(step.sporeBursts ?? []);
      if (generation !== this.generation) return;
      await this.clearGems(step.cleared, step.bonusFusion);
      if (generation !== this.generation) return;
      if (step.collectedRelics?.length) {
        await this.clearGems(step.collectedRelics.map(({ index }) => index));
        if (generation !== this.generation) return;
        this.bonuses.callout(
          t(mineRelicAppearance(this.theme).id === 'pearl' ? 'PEARL DELIVERED!' : 'RELIC FOUND!'),
          this.position(step.collectedRelics[0].index),
          0xffdf7a,
        );
      }
      for (const update of step.tileUpdates ?? []) {
        const tile = this.tiles[update.index];
        if (tile) {
          if (tile.health > (update.health ?? tile.health)) {
            const p = this.position(update.index);
            if (tile.bonusOnly) this.particles?.emitBurst?.(p, 0xda9747, update.health ? 8 : 14);
            else if (!tile.rootKnot && tile.fossilGroup == null)
              this.particles?.emitIce?.(p, update.health === 0 ? 8 : 4);
            if (update.health === 0 && !this.reducedMotion) {
              const ref = spriteRef(
                tileTexture(tile, { damaged: true, frozen: false }),
                this.scene.textures,
              );
              const chip = this.scene.add
                .image(p.x, p.y, ref.key, ref.frame)
                .setDisplaySize(this.cellSize - 3, this.cellSize - 3);
              this.effect(chip, {
                scaleX: chip.scaleX * 1.18,
                scaleY: chip.scaleY * 1.18,
                alpha: 0,
                duration: 180,
                ease: 'Quad.easeOut',
              });
            }
          }
          Object.assign(tile, update);
        }
      }
      this.drawCells((step.tileUpdates ?? []).map(({ index }) => index));
      for (const fossil of step.collectedFossils ?? [])
        this.bonuses.callout(t('FOSSIL FOUND!'), this.position(fossil.indices[0]), 0xecd39b);
      const reveals = [];
      for (const { index, gem } of step.bonuses ?? []) {
        this.releaseGem(this.indexToGemId[index]);
        this.createGem(gem, index);
        this.indexToGemId[index] = gem.id;
        reveals.push(this.bonuses.created(gem, index));
        this.audio?.playBonusAppears?.();
      }
      // Finish the match's earned-bonus reveal before gravity or the next activation.
      await Promise.all(reveals);
      if (generation !== this.generation) return;
      // Drop existing gems and fill empty cells in the same phase.
      const falls = [];
      for (const { from, gem } of step.drops)
        if (this.indexToGemId[from] === gem.id) this.indexToGemId[from] = null;
      for (const { from, to, gem, path } of step.drops) {
        const sprite = this.gemSprites.get(gem.id);
        this.indexToGemId[to] = gem.id;
        if (sprite)
          falls.push(
            path
              ? this.fallAlong(sprite, path)
              : this.fall(sprite, to, Math.ceil((to - from) / this.boardCols)),
          );
      }
      const columnCounts = new Map();
      for (const { index, path } of step.spawns)
        columnCounts.set(
          (path?.[0] ?? index) % this.boardCols,
          (columnCounts.get((path?.[0] ?? index) % this.boardCols) ?? 0) + 1,
        );
      for (const { index, gem, path } of step.spawns) {
        const sprite = this.createGem(gem, index);
        const entry = path?.[0] ?? index;
        const distance = columnCounts.get(entry % this.boardCols);
        if (path) {
          const p = this.position(entry);
          sprite.setPosition(p.x, p.y);
        }
        sprite.y -= distance * this.cellSize;
        this.indexToGemId[index] = gem.id;
        falls.push(path ? this.fallAlong(sprite, path, true) : this.fall(sprite, index, distance));
      }
      await Promise.all(falls);
    }
  }

  fall(sprite, index, distance) {
    return this.tween(sprite, {
      ...this.position(index),
      duration: this.reducedMotion ? 90 : MOTION.fall + Math.min(5, distance) * 12,
      ease: 'Bounce.easeOut',
    });
  }

  async fallAlong(sprite, path, entering = false) {
    const generation = this.generation;
    if (this.reducedMotion) return this.fall(sprite, path.at(-1), path.length);
    const stops = fallWaypoints(path, this.boardCols);
    for (const index of entering ? stops : stops.slice(1)) {
      if (generation !== this.generation) return;
      const p = this.position(index);
      const distance = Math.hypot(p.x - sprite.x, p.y - sprite.y) / this.cellSize;
      await this.tween(sprite, {
        ...p,
        duration: Math.min(220, 90 + distance * 22),
        ease: 'Quad.easeInOut',
      });
    }
  }

  async playSporeBursts(bursts) {
    await Promise.all(
      bursts.map(({ index, axis, targets }) => {
        const p = this.position(index);
        const points = (targets?.length ? targets : [index]).map((target) => this.position(target));
        const horizontal = axis === 'row';
        const low = Math.min(...points.map((point) => (horizontal ? point.x : point.y)));
        const high = Math.max(...points.map((point) => (horizontal ? point.x : point.y)));
        const beam = this.scene.add.rectangle(
          horizontal ? (low + high) / 2 : p.x,
          horizontal ? p.y : (low + high) / 2,
          horizontal ? high - low + this.cellSize * 0.7 : this.cellSize * 0.16,
          horizontal ? this.cellSize * 0.16 : high - low + this.cellSize * 0.7,
          0x9cffe0,
          0.85,
        );
        return this.effect(beam, {
          alpha: 0,
          duration: this.reducedMotion ? 90 : 240,
          ease: 'Quad.easeOut',
        });
      }),
    );
  }

  async clearGems(indices, fusion) {
    const generation = this.generation;
    const detonate = fusion && !this.reducedMotion;
    const origins = detonate ? fusion.pair.map(({ index }) => this.position(index)) : [];
    const center = detonate
      ? { x: (origins[0].x + origins[1].x) / 2, y: (origins[0].y + origins[1].y) / 2 }
      : null;
    const entries = indices.map((index) => ({
      index,
      id: this.indexToGemId[index],
      sprite: this.gemSprites.get(this.indexToGemId[index]),
    }));
    await Promise.all(
      entries.map(({ sprite, index }) => {
        if (!sprite) return;
        const p = this.position(index);
        const dx = detonate ? p.x - center.x : 0,
          dy = detonate ? p.y - center.y : 0;
        const distance = Math.max(1, Math.hypot(dx, dy));
        if (!detonate) this.particles?.emitBurst(p, GEM_COLORS[sprite.__gemType], 9);
        return this.tween(sprite, {
          ...(detonate
            ? {
                x: p.x + (dx / distance) * this.cellSize * 1.8,
                y: p.y + (dy / distance) * this.cellSize * 1.8,
                angle: index % 2 ? 100 : -100,
                delay: Math.min(180, (distance / this.cellSize) * 28),
                onStart: () => this.particles?.emitBurst(p, GEM_COLORS[sprite.__gemType], 12),
              }
            : {}),
          scaleX: sprite.scaleX * (detonate ? 0.2 : 1.25),
          scaleY: sprite.scaleY * (detonate ? 0.2 : 1.25),
          alpha: 0,
          duration: this.reducedMotion ? 45 : detonate ? 230 : MOTION.clear,
          ease: 'Quad.easeOut',
        });
      }),
    );
    if (generation !== this.generation) return;
    entries.forEach(({ id, index }) => {
      this.releaseGem(id);
      this.indexToGemId[index] = null;
    });
  }

  async effect(object, config) {
    // Simultaneous special chains have a fixed cosmetic budget.
    if (this.effects.size >= 160) {
      object.destroy();
      return;
    }
    this.effects.add(object);
    this.fxLayer.add(object);
    const generation = this.generation;
    await this.tween(object, config);
    if (generation !== this.generation) return;
    object.destroy();
    this.effects.delete(object);
  }

  ring(p, color, radius) {
    if (this.reducedMotion) return;
    const ring = this.scene.add
      .circle(p.x, p.y, radius, color, 0)
      .setStrokeStyle(2, color)
      .setScale(0.2)
      .setBlendMode('ADD');
    this.effect(ring, { scale: 1, alpha: 0, duration: 360, ease: 'Cubic.easeOut' });
  }

  celebrate(combo) {
    if (this.reducedMotion) return;
    const p = { x: (this.boardCols * this.cellSize) / 2, y: this.boardRows * this.cellSize * 0.4 };
    const label =
      combo >= 7
        ? 'UNSTOPPABLE!'
        : combo >= 5
          ? 'MEGA CASCADE!'
          : combo >= 3
            ? 'SUPER COMBO!'
            : 'DOUBLE!';
    this.bonuses.callout(`${t(label)} ×${combo}`, p, combo >= 4 ? 0xffd86a : 0xee8bff);
    this.audio?.playArcadeCue?.('reward', Math.min(combo, 5));
    if (combo >= 4) this.onImpact?.({ color: '#e987ff', type: 'cascade' });
    this.ring(p, 0xffdc91, this.cellSize * 3);
  }

  // Redraw only cells whose tile changed. A different board size redraws all cells.
  updateTiles(tiles) {
    const previous = this.tiles;
    this.tiles = tiles.map((tile) => (tile ? { ...tile } : null));
    const changed = this.tiles.flatMap((tile, index) =>
      sameTile(tile, previous[index]) ? [] : [index],
    );
    // A new board shape or gravity flow also changes the outline.
    const reshaped =
      previous.length !== this.tiles.length ||
      changed.some(
        (index) =>
          isPlayableCell(this.tiles[index]) !== isPlayableCell(previous[index]) ||
          this.tiles[index]?.flowTo !== previous[index]?.flowTo,
      );
    this.drawCells(reshaped ? undefined : changed);
  }

  // `indices` limits the pass to changed cells during a move. Omit it after a layout,
  // level or display-setting change to redraw the whole board and its outline.
  drawCells(indices) {
    if (!this.scene?.add || !this.cellSize) return;
    this.touch();
    const count = this.boardCols * this.boardRows;
    if (indices) {
      for (const index of indices) if (index < count) this.drawCell(index);
    } else {
      for (let index = 0; index < count; index++) this.drawCell(index);
      for (const index of [...this.cellHighlights.keys()])
        if (index >= count) this.removeCell(index);
      this.drawBoardOutline();
    }
    this.drawRootLinks();
  }

  removeCell(index) {
    for (const map of [
      this.cellHighlights,
      this.iceSprites,
      this.tileOverlays,
      this.fossilSprites,
    ]) {
      map.get(index)?.destroy();
      map.delete(index);
    }
  }

  drawCell(index) {
    const tile = this.tiles[index];
    if (!isPlayableCell(tile)) {
      this.removeCell(index);
      return;
    }
    const p = this.position(index);
    const health = tile?.health ?? 0;
    const frozen = tile?.state === 'FROZEN';
    const contrast = this.settings?.highContrastMode;
    const fill = tile?.fossilGroup != null ? 0x3e3024 : health > 0 || frozen ? 0x1b2130 : 0x141324;
    const stroke =
      tile?.fossilGroup != null
        ? 0xd3b87c
        : tile?.rootKnot
          ? 0xc6ae76
          : frozen
            ? 0xb0c7d4
            : health
              ? 0x718797
              : 0x272538;
    let cell = this.cellHighlights.get(index);
    if (!cell) {
      cell = this.scene.add.rectangle(p.x, p.y, 1, 1);
      this.backgroundLayer.add(cell);
      this.cellHighlights.set(index, cell);
    }
    let ice = this.iceSprites.get(index);
    if ((health > 0 && !tile?.sealColor) || frozen) {
      const damaged = health < (tile?.maxHealth ?? health);
      const ref = spriteRef(tileTexture(tile, { damaged, frozen }), this.scene.textures);
      if (!ice) {
        ice = this.scene.add.image(p.x, p.y, ref.key, ref.frame);
        this.backgroundLayer.add(ice);
        this.iceSprites.set(index, ice);
      }
      ice
        .setTexture(ref.key, ref.frame)
        .setPosition(p.x, p.y)
        .setDisplaySize(this.cellSize - 3, this.cellSize - 3);
    } else if (ice) {
      ice.destroy();
      this.iceSprites.delete(index);
    }
    cell
      .setPosition(p.x, p.y)
      .setSize(this.cellSize - 3, this.cellSize - 3)
      .setFillStyle(fill, 0.92)
      .setStrokeStyle(contrast ? 2 : 1, stroke, contrast ? 1 : frozen ? 0.5 : 0.22);
    this.drawFossilFloor(index);
    this.drawTileOverlay(index);
  }

  // Cracks traced from the cracked stone art, in its 160-unit frame.
  drawCracks(size) {
    const unit = size / 160;
    const graphic = this.scene.add.graphics();
    for (const [width, color] of [
      [7, 0x231b2b],
      [2.5, 0xffe2a0],
    ]) {
      graphic.lineStyle(width * unit, color, 0.95);
      for (const crack of CRACKS) {
        graphic.beginPath().moveTo((crack[0][0] - 80) * unit, (crack[0][1] - 80) * unit);
        for (const [x, y] of crack.slice(1)) graphic.lineTo((x - 80) * unit, (y - 80) * unit);
        graphic.strokePath();
      }
    }
    return graphic;
  }

  // Board shape and gravity flow are fixed for a level; redraw only when they change.
  drawBoardOutline() {
    const shaped = this.tiles.some((tile) => !isPlayableCell(tile));
    const key = `${this.cellSize}-${this.boardCols}-${this.boardRows}-${this.tiles.map((tile) => `${tile?.type === 'void' ? 'x' : '.'}:${tile?.flowTo ?? ''}`).join(',')}`;
    if (key === this.boardOutlineKey) return;
    this.boardOutlineKey = key;
    this.boardOutline?.destroy();
    this.boardOutline = null;
    if (!shaped) return;
    const graphic = this.scene.add.graphics();
    graphic.lineStyle(Math.max(2, this.cellSize * 0.045), 0xd6bd88, 0.85);
    for (const [x1, y1, x2, y2] of boardEdges(this.tiles, this.boardCols, this.boardRows))
      graphic
        .beginPath()
        .moveTo(x1 * this.cellSize, y1 * this.cellSize)
        .lineTo(x2 * this.cellSize, y2 * this.cellSize)
        .strokePath();
    graphic.lineStyle(Math.max(2, this.cellSize * 0.045), 0xade5d9, 0.9);
    for (let index = 0; index < this.tiles.length; index++) {
      const next = gravityDestination(this.tiles, index, this.boardCols, this.boardRows);
      if (next < 0 || next % this.boardCols === index % this.boardCols) continue;
      const p = this.position(index),
        direction = Math.sign((next % this.boardCols) - (index % this.boardCols)),
        s = this.cellSize;
      const x = p.x + direction * s * 0.32,
        y = p.y + s * 0.32;
      graphic
        .beginPath()
        .moveTo(x - direction * s * 0.14, y - s * 0.14)
        .lineTo(x, y)
        .lineTo(x - direction * s * 0.13, y)
        .strokePath();
      graphic
        .beginPath()
        .moveTo(x, y)
        .lineTo(x, y - s * 0.13)
        .strokePath();
    }
    this.tileLayer.add(graphic);
    this.boardOutline = graphic;
  }

  drawFossilFloor(index) {
    const tile = this.tiles[index];
    let sprite = this.fossilSprites.get(index);
    if (tile?.fossilGroup == null) {
      sprite?.destroy();
      this.fossilSprites.delete(index);
      return;
    }
    const ref = spriteRef('tile-fossil', this.scene.textures);
    if (!sprite) {
      sprite = this.scene.add.image(0, 0, ref.key, ref.frame);
      this.backgroundLayer.add(sprite);
      this.fossilSprites.set(index, sprite);
    }
    const part = tile.fossilPart ?? 0;
    const x = part % 2,
      y = Math.floor(part / 2);
    const p = this.position(index);
    // Crop one quarter of the same fossil art into each cell. Gems remain in
    // their own layer above both sediment and the gradually revealed fossil.
    sprite
      .setPosition(p.x + (0.5 - x) * this.cellSize, p.y + (0.5 - y) * this.cellSize)
      .setDisplaySize(this.cellSize * 2, this.cellSize * 2)
      .setCrop(x * 80, y * 80, 80, 80)
      .setAlpha(tile.fossilCollected ? 0.45 : tile.health > 0 ? 0.12 : 0.82);
  }

  // Each living root knot binds the chained cells of its group.
  drawRootLinks() {
    const knots = [],
      bindings = new Map();
    this.tiles.forEach((tile, index) => {
      if (tile?.rootKnot && tile.rootGroup != null && tile.health > 0) knots.push(index);
      if (tile?.chainHealth > 0) {
        if (!bindings.has(tile.rootGroup)) bindings.set(tile.rootGroup, []);
        bindings.get(tile.rootGroup).push(index);
      }
    });
    const links = knots.flatMap((knot) =>
      (bindings.get(this.tiles[knot].rootGroup) ?? []).map((binding) => [knot, binding]),
    );
    const key = `${this.cellSize}-${this.boardCols}-${links.map((link) => link.join(':')).join(',')}`;
    if (key === this.rootLinksKey) return;
    this.rootLinksKey = key;
    this.rootLinks?.destroy();
    this.rootLinks = null;
    if (!links.length) return;
    const graphic = this.scene.add.graphics();
    graphic.lineStyle(Math.max(3, this.cellSize * 0.065), 0xcfb97b, 0.85);
    for (const [knot, binding] of links) {
      const start = this.position(knot),
        end = this.position(binding);
      graphic.beginPath().moveTo(start.x, start.y).lineTo(end.x, end.y).strokePath();
    }
    this.backgroundLayer.add(graphic);
    this.rootLinks = graphic;
  }

  drawTileOverlay(index) {
    if (!this.tileLayer) return;
    const tile = this.tiles[index];
    const sealColor = tile?.health > 0 ? tile.sealColor : null;
    const chained = tile?.chainHealth > 0;
    const layers = tile?.health > 1 ? tile.health : 0;
    const frozen = tile?.state === 'FROZEN';
    const signal =
      tile?.signalHealth === 0 && VANISHING_SIGNALS.has(tile.signal) ? null : tile?.signal;
    const key = `${layers}-${frozen}-${sealColor ?? ''}-${chained}-${!!tile?.exit}-${tile?.signal ?? ''}-${tile?.signalHealth}-${tile?.surveyOrder}-${tile?.rootGroup ?? ''}-${tile?.bonusOnly}-${tile?.sporeAxis}-${tile?.health}-${tile?.maxHealth}-${this.theme}-${this.cellSize}`;
    let overlay = this.tileOverlays.get(index);
    if (overlay?.__tileKey === key) return;
    overlay?.destroy();
    this.tileOverlays.delete(index);
    if (
      !sealColor &&
      !chained &&
      !tile?.exit &&
      !layers &&
      !frozen &&
      !signal &&
      !(tile?.bonusOnly && tile.health > 0)
    )
      return;
    const p = this.position(index);
    const size = this.cellSize - 3;
    overlay = this.scene.add.container(p.x, p.y);
    overlay.__tileKey = key;
    const addImage = (type) => {
      const ref = spriteRef(`tile-${type}`, this.scene.textures);
      const sprite = this.scene.add.image(0, 0, ref.key, ref.frame).setDisplaySize(size, size);
      overlay.add(sprite);
      return sprite;
    };
    const addLabel = (x, y, text, style) => {
      const label = glyphImage(this.scene, x, y, text, {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        ...style,
      });
      overlay.add(label);
      return label;
    };
    if (tile.exit) addImage(mineRelicAppearance(this.theme).exitTexture.slice(5));
    if (sealColor) addImage(`seal-${sealColor}`);
    if (layers || frozen)
      addLabel(size * 0.23, -size * 0.46, frozen ? '❄' : String(layers), {
        fontSize: `${Math.max(12, size * 0.23)}px`,
        color: '#ffffff',
        backgroundColor: tile.rootKnot || tile.fossilGroup != null ? '#5b4129' : '#24384f',
        padding: { x: 3, y: 1 },
      }).setOrigin(0);
    if (chained) addImage(tile.rootGroup != null ? 'vine' : 'chain');
    if (tile.bonusOnly && tile.fossilGroup != null && tile.health > 0)
      addImage('blast-mark')
        .setPosition(-size * 0.28, size * 0.28)
        .setDisplaySize(size * 0.39, size * 0.39);
    // A blast-only obstacle that has taken a hit shows cracks until its last one.
    if (tile.bonusOnly && tile.health > 0 && tile.health < (tile.maxHealth ?? tile.health))
      overlay.add(this.drawCracks(size));
    if (signal) {
      const lit = tile.signalHealth === 0;
      const skin = mineSignalAppearance(this.theme, tile.signal);
      const ref = spriteRef(skin?.texture ?? `tile-${tile.signal}`, this.scene.textures);
      const marker = this.scene.add
        .image(-size * 0.3, size * 0.29, ref.key, ref.frame)
        .setDisplaySize(size * 0.43, size * 0.43)
        .setAlpha(lit ? 0.35 : 1);
      overlay.add(marker);
      if (tile.signal === 'spore')
        addLabel(size * 0.16, size * 0.32, lit ? '✓' : tile.sporeAxis === 'column' ? '↕' : '↔', {
          fontSize: `${Math.max(17, size * 0.34)}px`,
          color: lit ? '#abdfc7' : '#ffffff',
          stroke: '#153a38',
          strokeThickness: 3,
          backgroundColor: '#153a38',
        });
      // Charge pips: one small static dot per charge, rebuilt only when the charge changes.
      if (tile.signal === 'core')
        for (let pip = 0, pips = tile.coreCharges ?? CORE_CHARGES; pip < pips; pip++)
          overlay.add(
            this.scene.add
              .circle(
                -size * 0.06 + pip * size * 0.11,
                size * 0.41,
                Math.max(2.5, size * 0.04),
                pip < pips - tile.signalHealth ? 0xffd36e : 0x1d3f55,
                1,
              )
              .setStrokeStyle(1.5, 0xbff6ff, 0.95),
          );
      if (tile.surveyOrder)
        addLabel(-size * 0.3, size * 0.29, lit ? '✓' : String(tile.surveyOrder), {
          fontSize: `${Math.max(11, size * 0.21)}px`,
          color: lit ? '#315932' : '#fff7d5',
        });
    }
    this.tileLayer.add(overlay);
    this.tileOverlays.set(index, overlay);
  }

  showMarkers(key, indices, color) {
    this.touch();
    this.clearMarkers(key);
    if (!this.scene?.add) return;
    indices = indices.filter((index) => isPlayableCell(this.tiles[index]));
    const objects = indices.map((index) => {
      const p = this.position(index);
      const marker = this.scene.add
        .rectangle(p.x, p.y, this.cellSize - 4, this.cellSize - 4, color, 0.1)
        .setStrokeStyle(2, color, 0.95);
      this.fxLayer.add(marker);
      return marker;
    });
    this.markers.set(key, { indices, color, objects });
  }
  clearMarkers(key) {
    this.touch();
    if (key === undefined) {
      [...this.markers.keys()].forEach((k) => this.clearMarkers(k));
      return;
    }
    this.markers.get(key)?.objects.forEach((object) => {
      this.scene?.tweens?.killTweensOf(object);
      object.destroy();
    });
    this.markers.delete(key);
  }
  highlightCell(index, active = true) {
    if (active) this.showMarkers('selected', [index], 0xf8d890);
    else this.clearMarkers('selected');
  }
  clearCellHighlights() {
    this.clearMarkers('selected');
  }
  showQueuedSwap(a, b) {
    this.showMarkers('queued', [a, b], 0xdec7ff);
  }
  clearQueuedSwapHighlight() {
    this.clearMarkers('queued');
  }
  showQueuedBonus(index) {
    this.showMarkers('bonus', [index], 0xffc37d);
  }
  clearQueuedBonusHighlight() {
    this.clearMarkers('bonus');
  }
  showHintMove(indices) {
    this.showMarkers('hint', indices, 0x9bf9d7);
    if (this.reducedMotion) return;
    this.markers.get('hint')?.objects.forEach((marker, index) => {
      this.scene.tweens.add({
        targets: marker,
        scaleX: 0.88,
        scaleY: 0.88,
        alpha: 0.4,
        duration: 550,
        delay: index * 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }
  clearHintMove() {
    this.clearMarkers('hint');
  }
  showBonusPreview(indices) {
    this.showMarkers('preview', indices, 0xa4e7ff);
  }
  clearBonusPreview() {
    this.clearMarkers('preview');
  }
  fadeBonusPreview() {
    this.touch();
    const preview = this.markers.get('preview');
    this.markers.delete('preview');
    for (const marker of preview?.objects ?? []) {
      if (this.reducedMotion) marker.destroy();
      else this.effect(marker, { alpha: 0, duration: 180, ease: 'Quad.easeOut' });
    }
  }
}
