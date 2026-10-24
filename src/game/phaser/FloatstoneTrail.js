// A floatstone's route lights up as the match that frees it clears: a soft lane along
// the cells it will pass and chevrons pulsing on ahead of it towards its destination.
// It lifts off with a ring and a puff of sparks (BoardAnimator.liftOff); as it moves, a
// streak follows in its wake and a glow travels with it. Everything fades once it settles. Floatstones travel against gravity, so all of it follows the
// route's own direction, up or down.

const LANE = 0xb4fff0;
const GLOW = 0xfff1c6;
const FADE_IN = 50;
const FADE_OUT = 240;
// The chevrons light up one cell after another this far apart (ms), then a brighter
// pulse keeps running through them towards the destination once every PULSE ms.
const SWEEP = 40;
const PULSE = 320;
// The streak reaches back to where the stone was this long ago (ms).
const WAKE = 75;
// A lit path whose stone never sets off (a cancelled move) fades after this long (ms).
const WAIT = 1500;
// Without motion, the path shows briefly as a still highlight (ms).
const STILL_PATH = 450;

const clamp = (value) => Math.min(1, Math.max(0, value));

// Soft canvas textures, made once per scene. Each points up: the lane is even along its
// length, the streak brightest at its head, the chevron an open arrow with a mint halo.
function makeTextures(scene) {
  const draw = (key, width, height, paint) => {
    if (scene.textures.exists(key)) return;
    const canvas = scene.textures.createCanvas(key, width, height);
    paint(canvas.getContext());
    canvas.refresh();
  };
  const column = (context, width, height, stops) => {
    const across = context.createLinearGradient(0, 0, width, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)');
    across.addColorStop(0.5, 'rgba(255,255,255,1)');
    across.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = across;
    context.fillRect(0, 0, width, height);
    const along = context.createLinearGradient(0, 0, 0, height);
    for (const [offset, alpha] of stops) along.addColorStop(offset, `rgba(255,255,255,${alpha})`);
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = along;
    context.fillRect(0, 0, width, height);
  };
  draw('float-lane', 32, 128, (context) =>
    column(context, 32, 128, [
      [0, 0],
      [0.14, 1],
      [0.86, 1],
      [1, 0],
    ]),
  );
  draw('float-streak', 32, 128, (context) =>
    column(context, 32, 128, [
      [0, 0],
      [0.1, 1],
      [1, 0],
    ]),
  );
  draw('float-glow', 64, 64, (context) => {
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
  });
  draw('float-chevron', 80, 60, (context) => {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const stroke = (width, color, blur) => {
      context.shadowColor = color;
      context.shadowBlur = blur;
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(16, 44);
      context.lineTo(40, 18);
      context.lineTo(64, 44);
      context.stroke();
    };
    stroke(15, 'rgba(120,236,214,0.75)', 9);
    stroke(7, '#ffffff', 3);
  });
}

export class FloatstoneTrail {
  constructor(animator) {
    this.animator = animator;
    // Reusable sets of effect objects, one per floatstone moving at the same time.
    this.sets = [];
    // Paths lit ahead of a move, by the cell their stone starts from.
    this.waiting = new Map();
  }

  // One set: the lane, chevrons, the streak and the glow.
  acquire(chevrons) {
    const { scene, gemLayer } = this.animator;
    let set = this.sets.find((candidate) => !candidate.busy);
    if (!set) {
      makeTextures(scene);
      // Normal blending: the board canvas is transparent, and additive light would
      // leave darker seams over the gaps between cells.
      const image = (key) => {
        const object = scene.add.image(0, 0, key).setVisible(false);
        gemLayer.add(object);
        return object;
      };
      set = {
        image,
        lane: image('float-lane').setTint(LANE),
        chevrons: [],
        streak: image('float-streak').setTint(LANE),
        glow: image('float-glow').setTint(GLOW),
      };
      this.sets.push(set);
    }
    while (set.chevrons.length < chevrons) set.chevrons.push(set.image('float-chevron'));
    set.objects = [set.lane, ...set.chevrons, set.streak, set.glow];
    set.busy = true;
    set.motion = null;
    set.lifted = false;
    return set;
  }

  release(set) {
    set.tween = null;
    set.busy = false;
    set.motion = null;
    for (const [key, waiting] of this.waiting) if (waiting === set) this.waiting.delete(key);
    for (const object of set.objects) object.setVisible(false);
  }

  // The lane lies under the gems, showing through the cells they leave and the gaps
  // between them; the rest stays above the gems sinking past, below the stone itself.
  raise(set, sprite) {
    const { gemLayer } = this.animator;
    for (const object of set.objects)
      if (object === set.lane) gemLayer.sendToBack(object);
      else gemLayer.bringToTop(object);
    if (sprite) gemLayer.bringToTop(sprite);
  }

  // Lay the lane along the route, from its first cell to the last, and a chevron
  // pointing the way in every cell ahead of the stone.
  layout(set, route) {
    const size = this.animator.cellSize;
    const pixels = (cells) => (cells + 0.5) * size;
    const start = route[0],
      end = route.at(-1),
      cells = route.length - 1;
    const angle = Math.atan2(end.row - start.row, end.col - start.col) + Math.PI / 2;
    Object.assign(set, {
      route,
      cells,
      direction: { col: Math.sign(end.col - start.col), row: Math.sign(end.row - start.row) },
    });
    set.lane
      .setVisible(true)
      .setAlpha(0)
      .setPosition(pixels((start.col + end.col) / 2), pixels((start.row + end.row) / 2))
      .setDisplaySize(size * 0.46, size * (cells + 0.9))
      .setRotation(angle);
    set.streak.setVisible(true).setAlpha(0).setRotation(angle);
    set.glow
      .setVisible(true)
      .setAlpha(0)
      .setPosition(pixels(start.col), pixels(start.row))
      .setDisplaySize(size * 1.55, size * 1.55);
    set.chevronScale = (size * 0.5) / 80;
    set.chevrons.forEach((chevron, index) => {
      const cell = route[index + 1];
      chevron.setVisible(!!cell).setAlpha(0).setRotation(angle);
      if (cell) chevron.setPosition(pixels(cell.col), pixels(cell.row));
    });
  }

  // Everything at `time` ms after the path lit up. The stone sets off at `set.departs`.
  update(set, time) {
    const size = this.animator.cellSize;
    const pixels = (cells) => (cells + 0.5) * size;
    const { motion, route, cells, direction } = set;
    const moved = motion ? time - set.departs : -1;
    const fade =
      clamp(time / FADE_IN) *
      (motion ? clamp(1 - (moved - motion.duration) / FADE_OUT) : clamp((WAIT - time) / FADE_OUT));
    if (motion && moved >= 0 && !set.lifted) {
      set.lifted = true;
      this.animator.liftOff(route[0], {
        col: route[1].col - route[0].col,
        row: route[1].row - route[0].row,
      });
    }
    let col = route[0].col,
      row = route[0].row,
      travelled = 0;
    if (moved > 0) {
      const point = motion(Math.min(1, moved / motion.duration));
      col = point.col;
      row = point.row;
      travelled = point.travelled ?? 0;
    }
    // The glow gathers on the stone before it sets off and travels with it.
    set.glow.setPosition(pixels(col), pixels(row)).setAlpha((moved > 0 ? 0.8 : 0.45) * fade);
    set.lane.setAlpha(0.5 * fade);
    // The streak runs from where the stone was a moment ago to where it is now.
    if (moved > 0) {
      const wake = motion(Math.min(1, Math.max(0, moved - WAKE) / motion.duration));
      const length = Math.hypot(col - wake.col, row - wake.row) * size;
      set.streak
        .setPosition(pixels((col + wake.col) / 2), pixels((row + wake.row) / 2))
        .setDisplaySize(size * 0.34, length + size * 0.5)
        .setAlpha(0.75 * fade * clamp(length / (size * 0.6)));
    }
    // Each chevron lights up in turn and pulses forward with the wave running through
    // them, and goes out as the stone reaches its cell.
    for (let index = 0; index < cells; index++) {
      const phase = time - index * SWEEP;
      const pulse = phase > 0 ? Math.sin(Math.PI * ((phase / PULSE + 0.25) % 1)) : 0;
      const alpha =
        clamp(phase / 45) * (0.55 + 0.45 * pulse) * clamp(1 - (travelled - index - 0.5) / 0.35);
      const cell = route[index + 1];
      const drift = size * (0.13 * pulse - 0.05);
      set.chevrons[index]
        .setPosition(
          pixels(cell.col) + direction.col * drift,
          pixels(cell.row) + direction.row * drift,
        )
        .setScale(set.chevronScale * (0.92 + 0.16 * pulse))
        .setAlpha(alpha * fade);
    }
  }

  // Light the route as the match that frees the stone clears, before it moves.
  prepare(sprite, route) {
    const { scene, gemLayer, reducedMotion } = this.animator;
    if (reducedMotion || !scene?.add || !scene.tweens || !gemLayer || route.length < 2) return;
    const key = `${route[0].col},${route[0].row}`;
    if (this.waiting.has(key)) return;
    const set = this.acquire(route.length - 1);
    this.layout(set, route);
    this.raise(set, sprite);
    this.waiting.set(key, set);
    this.update(set, 0);
    set.tween = scene.tweens.addCounter({
      from: 0,
      to: WAIT,
      duration: WAIT,
      onUpdate: (tween) => this.update(set, tween.getValue()),
      onComplete: () => this.release(set),
    });
  }

  // The stone sets off along `route` with its own `motion` (see fallMotion), `delay` ms
  // into its tween. Its path carries on from `prepare`, or lights up now.
  play(sprite, route, motion, delay = 0) {
    const { scene, gemLayer } = this.animator;
    if (!scene?.add || !scene.tweens || !gemLayer || route.length < 2) return;
    const key = `${route[0].col},${route[0].row}`;
    let set = this.waiting.get(key);
    let time = 0;
    if (set && set.cells === route.length - 1) {
      this.waiting.delete(key);
      time = set.tween?.getValue() ?? 0;
      set.tween?.remove();
    } else {
      if (set) {
        set.tween?.remove();
        this.release(set);
      }
      set = this.acquire(route.length - 1);
      this.layout(set, route);
    }
    this.raise(set, sprite);
    set.motion = motion;
    set.departs = time + delay;
    const end = set.departs + motion.duration + FADE_OUT;
    this.update(set, time);
    set.tween = scene.tweens.addCounter({
      from: time,
      to: end,
      duration: end - time,
      onUpdate: (tween) => this.update(set, tween.getValue()),
      onComplete: () => this.release(set),
    });
  }

  // Reduced motion: the path shows as a brief still highlight, without any movement.
  showPath(sprite, route) {
    const { scene, gemLayer } = this.animator;
    if (!scene?.add || !scene.tweens || !gemLayer || route.length < 2) return;
    const set = this.acquire(route.length - 1);
    this.layout(set, route);
    this.raise(set, sprite);
    set.lane.setAlpha(0.35);
    set.chevrons.forEach((chevron) => chevron.setScale(set.chevronScale).setAlpha(0.8));
    set.streak.setVisible(false);
    set.glow.setVisible(false);
    set.tween = scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: STILL_PATH,
      onComplete: () => this.release(set),
    });
  }

  clear() {
    for (const set of this.sets) {
      set.tween?.remove();
      for (const object of set.objects) object.destroy();
    }
    this.sets = [];
    this.waiting.clear();
  }
}
