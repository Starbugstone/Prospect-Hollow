import Phaser from 'phaser';
import { preloadSpriteAssets, loadSpriteAtlas } from './SpriteLoader';
import { createParticleFactory } from './ParticleFactory';

export class BoardScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BoardScene' });
  }
  preload() {
    preloadSpriteAssets(this, { levelId: this.levelId });
  }
  create() {
    const boardContainer = this.add.container(0, 0);
    const backgroundLayer = this.add.container(0, 0);
    const gemLayer = this.add.container(0, 0);
    const tileLayer = this.add.container(0, 0);
    const fxLayer = this.add.container(0, 0);
    boardContainer.add([backgroundLayer, gemLayer, tileLayer, fxLayer]);
    const { textures } = loadSpriteAtlas(this);
    const particles = createParticleFactory(this, fxLayer);
    this.onReady?.({
      scene: this,
      boardContainer,
      backgroundLayer,
      gemLayer,
      tileLayer,
      fxLayer,
      textures,
      particles,
    });
  }
}
