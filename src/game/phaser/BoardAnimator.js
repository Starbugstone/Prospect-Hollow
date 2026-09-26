import { spriteRef } from './spriteRefs';
import { t } from '../../i18n';
import { GEM_COLORS } from './SpriteLoader';
import { GEM_TYPES } from '../engine/GemFactory';
import { gemTexture } from '../../data/gemAppearance';
import { BonusEffects } from './BonusEffects';
import {
  cascadeTier,
  simultaneousMatchCount,
  multiMatchLabel,
  tierCoins,
  MULTI_MATCH_COIN_STEP,
} from '../engine/MatchRewards';

const MOTION = Object.freeze({ swap: 115, reject: 75, clear: 90, fall: 190, intro: 160 });

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
    boardLayout,
    settings,
    onImpact,
    onBanner,
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
      boardLayout,
      settings,
      onImpact,
      onBanner,
    });
    this.bonuses = new BonusEffects(this);
    this.iceSprites = new Map();
    this.tileOverlays = new Map();
    this.gemSprites = new Map();
    this.cellHighlights = new Map();
    this.indexToGemId = [];
    this.tiles = [];
    this.markers = new Map();
    this.effects = new Set();
    this.pending = new Set();
    this.generation = 0;
    this.cellSize = 0;
    this.boardSize = 0;
    this.boardRows = 0;
  }

  get reducedMotion() {
    return this.settings?.reducedMotion ?? false;
  }
  setAudioManager(audio) {
    this.audio = audio;
  }

  // Cancellation settles all pending promises, including when a level is exited mid-fall.
  clear() {
    this.generation++;
    for (const cancel of [...this.pending]) cancel();
    this.clearMarkers();
    this.gemSprites.forEach((sprite) => sprite.destroy());
    this.gemSprites.clear();
    this.indexToGemId = [];
    this.backgroundLayer?.removeAll?.(true);
    this.tileLayer?.removeAll?.(true);
    this.tileOverlays.clear();
    this.cellHighlights.clear();
    this.iceSprites.clear();
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
      x: ((index % this.boardSize) + 0.5) * this.cellSize,
      y: (Math.floor(index / this.boardSize) + 0.5) * this.cellSize,
    };
  }

  setLayout({ boardCols, boardRows, cellSize }) {
    const changed =
      boardCols !== this.boardSize || boardRows !== this.boardRows || cellSize !== this.cellSize;
    Object.assign(this, { boardSize: boardCols, boardRows, cellSize });
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
      boardSize: layout.boardCols,
      boardRows: layout.boardRows,
      cellSize: layout.cellSize,
    });
    if (!this.scene?.add) return;
    this.drawCells();
    this.syncToBoard(board);
  }

  createGem(gem, index) {
    const p = this.position(index);
    const texture = this.textures[gem.type] ?? this.textures.ruby;
    const sprite = this.scene.add.sprite(p.x, p.y, texture.key, texture.frame);
    this.configureGem(sprite, gem.type);
    this.gemLayer.add(sprite);
    this.gemSprites.set(gem.id, sprite);
    return sprite;
  }

  configureGem(sprite, type) {
    const texture = GEM_TYPES.includes(type)
      ? spriteRef(gemTexture(type, this.levelId), this.scene?.textures)
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
    this.gemSprites.forEach((sprite, id) => {
      if (!seen.has(id)) {
        sprite.destroy();
        this.gemSprites.delete(id);
      }
    });
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
            (index % this.boardSize) * 7 + Math.floor(index / this.boardSize) * 4,
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
      if (generation !== this.generation) return;
      await this.clearGems(step.cleared, step.bonusFusion);
      if (generation !== this.generation) return;
      if (step.collectedRelics?.length) {
        await this.clearGems(step.collectedRelics.map(({ index }) => index));
        if (generation !== this.generation) return;
        this.bonuses.callout(
          'RELIC FOUND!',
          this.position(step.collectedRelics[0].index),
          0xffdf7a,
        );
      }
      for (const update of step.tileUpdates ?? []) {
        const tile = this.tiles[update.index];
        if (tile) {
          if (tile.health > (update.health ?? tile.health)) {
            const p = this.position(update.index);
            this.particles?.emitIce?.(p, update.health === 0 ? 8 : 4);
            if (update.health === 0 && !this.reducedMotion) {
              const ref = spriteRef(
                tile.type === 'blocker' ? 'block-cracked' : 'ice-cracked',
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
      this.drawCells();
      const reveals = [];
      for (const { index, gem } of step.bonuses ?? []) {
        const oldId = this.indexToGemId[index];
        this.gemSprites.get(oldId)?.destroy();
        this.gemSprites.delete(oldId);
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
      for (const { from, to, gem } of step.drops) {
        const sprite = this.gemSprites.get(gem.id);
        this.indexToGemId[to] = gem.id;
        if (sprite) falls.push(this.fall(sprite, to, Math.ceil((to - from) / this.boardSize)));
      }
      const columnCounts = new Map();
      for (const { index } of step.spawns)
        columnCounts.set(
          index % this.boardSize,
          (columnCounts.get(index % this.boardSize) ?? 0) + 1,
        );
      for (const { index, gem } of step.spawns) {
        const sprite = this.createGem(gem, index);
        const distance = columnCounts.get(index % this.boardSize);
        sprite.y -= distance * this.cellSize;
        this.indexToGemId[index] = gem.id;
        falls.push(this.fall(sprite, index, distance));
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
    entries.forEach(({ sprite, id, index }) => {
      sprite?.destroy();
      this.gemSprites.delete(id);
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
    const p = { x: (this.boardSize * this.cellSize) / 2, y: this.boardRows * this.cellSize * 0.4 };
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

  updateTiles(tiles) {
    this.tiles = tiles.map((tile) => (tile ? { ...tile } : null));
    this.drawCells();
  }

  drawCells() {
    if (!this.scene?.add || !this.cellSize) return;
    const count = this.boardSize * this.boardRows;
    for (let index = 0; index < count; index++) {
      const p = this.position(index);
      const health = this.tiles[index]?.health ?? 0;
      const frozen = this.tiles[index]?.state === 'FROZEN';
      const contrast = this.settings?.highContrastMode;
      const fill = health > 0 || frozen ? 0x1b2130 : 0x141324;
      const stroke = frozen ? 0xb0c7d4 : health ? 0x718797 : 0x272538;
      let cell = this.cellHighlights.get(index);
      if (!cell) {
        cell = this.scene.add.rectangle(p.x, p.y, 1, 1);
        this.backgroundLayer.add(cell);
        this.cellHighlights.set(index, cell);
      }
      let ice = this.iceSprites.get(index);
      if ((health > 0 && !this.tiles[index]?.sealColor) || frozen) {
        const damaged = health < (this.tiles[index]?.maxHealth ?? health);
        const blocker = this.tiles[index]?.type === 'blocker';
        const texture = blocker
          ? damaged
            ? 'block-cracked'
            : health > 1
              ? 'block-reinforced'
              : 'block-stone'
          : damaged && !frozen
            ? 'ice-cracked'
            : 'ice-frost';
        const ref = spriteRef(texture, this.scene.textures);
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
      this.drawTileOverlay(index);
    }
    this.cellHighlights.forEach((cell, index) => {
      if (index >= count) {
        cell.destroy();
        this.cellHighlights.delete(index);
        this.iceSprites.get(index)?.destroy();
        this.iceSprites.delete(index);
        this.tileOverlays.get(index)?.destroy();
        this.tileOverlays.delete(index);
      }
    });
  }

  drawTileOverlay(index) {
    if (!this.tileLayer) return;
    const tile = this.tiles[index];
    const sealColor = tile?.health > 0 ? tile.sealColor : null;
    const chained = tile?.chainHealth > 0;
    const layers = tile?.health > 1 ? tile.health : 0;
    const frozen = tile?.state === 'FROZEN';
    const key = `${layers}-${frozen}-${sealColor ?? ''}-${chained}-${!!tile?.exit}-${tile?.signal ?? ''}-${tile?.signalHealth}-${tile?.surveyOrder}-${this.cellSize}`;
    let overlay = this.tileOverlays.get(index);
    if (overlay?.__tileKey === key) return;
    overlay?.destroy();
    this.tileOverlays.delete(index);
    if (!sealColor && !chained && !tile?.exit && !layers && !frozen && !tile?.signal) return;
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
    if (tile.exit) addImage('exit');
    if (sealColor) {
      addImage(`seal-${sealColor}`);
    }
    if (layers || frozen) {
      const badge = this.scene.add.text(size * 0.23, -size * 0.46, frozen ? '❄' : String(layers), {
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        fontSize: `${Math.max(12, size * 0.23)}px`,
        color: '#ffffff',
        backgroundColor: '#24384f',
        padding: { x: 3, y: 1 },
      });
      overlay.add(badge);
    }
    if (chained) addImage('chain');
    if (tile.signal) {
      const lit = tile.signalHealth === 0;
      const ref = spriteRef(`tile-${tile.signal}`, this.scene.textures);
      const marker = this.scene.add
        .image(-size * 0.3, size * 0.29, ref.key, ref.frame)
        .setDisplaySize(size * 0.43, size * 0.43)
        .setAlpha(lit ? 0.5 : 1);
      overlay.add(marker);
      if (tile.surveyOrder)
        overlay.add(
          this.scene.add
            .text(-size * 0.3, size * 0.29, lit ? '✓' : String(tile.surveyOrder), {
              fontFamily: 'Arial, sans-serif',
              fontStyle: 'bold',
              fontSize: `${Math.max(11, size * 0.21)}px`,
              color: lit ? '#315932' : '#fff7d5',
            })
            .setOrigin(0.5),
        );
    }
    this.tileLayer.add(overlay);
    this.tileOverlays.set(index, overlay);
  }

  showMarkers(key, indices, color) {
    this.clearMarkers(key);
    if (!this.scene?.add) return;
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
  setGemHighlight() {}
  clearGemHighlights() {}
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
    const preview = this.markers.get('preview');
    this.markers.delete('preview');
    for (const marker of preview?.objects ?? []) {
      if (this.reducedMotion) marker.destroy();
      else this.effect(marker, { alpha: 0, duration: 180, ease: 'Quad.easeOut' });
    }
  }
}
