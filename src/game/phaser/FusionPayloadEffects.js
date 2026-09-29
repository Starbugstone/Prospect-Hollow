const COLORS = [0xff718f, 0xffc75b, 0x9bffbe, 0x72edff, 0xb39aff, 0xff8ae9];

export function emitFusionDebris(a, combo, center) {
  const size = a.cellSize;
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12 + 0.12;
    const distance = size * (2.5 + (i % 4));
    const shard = a.scene.add.graphics({ x: center.x, y: center.y });
    const color = combo.key.includes('rainbow')
      ? COLORS[i % COLORS.length]
      : i % 2
        ? combo.color
        : combo.accent;
    shard
      .fillStyle(color, 0.95)
      .fillTriangle(-size * 0.12, 0, size * 0.1, -size * 0.12, size * 0.05, size * 0.24);
    shard.lineStyle(1, 0xffffff, 0.8).lineBetween(-size * 0.12, 0, size * 0.1, -size * 0.12);
    a.effect(shard, {
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance + size * 0.8,
      angle: i % 2 ? 280 : -220,
      scale: 0.15,
      alpha: { value: 0, ease: 'Quad.easeIn' },
      duration: 650 + (i % 3) * 110,
      ease: 'Cubic.easeOut',
    });
  }
}

function comet(a, from, to, color, duration) {
  const size = a.cellSize;
  const art = a.scene.add.graphics({ x: from.x, y: from.y }).setBlendMode('ADD');
  art.fillStyle(color, 0.45).fillTriangle(-size * 1.1, 0, 0, -size * 0.18, 0, size * 0.18);
  art.fillStyle(color, 0.9).fillCircle(0, 0, size * 0.14);
  art.fillStyle(0xffffff).fillCircle(0, 0, size * 0.06);
  art.setRotation(Math.atan2(to.y - from.y, to.x - from.x));
  a.effect(art, { x: to.x, y: to.y, duration, ease: 'Cubic.easeIn' });
}

function blast(a, node, color) {
  const p = a.position(node.index),
    size = a.cellSize;
  const radius = size * (node.radius + 0.65);
  // Dark, colored smoke gives the white-hot center a visible silhouette.
  const cloud = a.scene.add.graphics({ x: p.x, y: p.y });
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    cloud.fillStyle(i % 2 ? 0x783052 : 0xb3483c, 0.42);
    cloud.fillCircle(
      Math.cos(angle) * radius * 0.55,
      Math.sin(angle) * radius * 0.55,
      radius * 0.5,
    );
  }
  cloud.setScale(0.1);
  a.effect(cloud, {
    scale: 1.25,
    alpha: { value: 0, ease: 'Quad.easeIn' },
    duration: 640,
    ease: 'Cubic.easeOut',
  });
  const fire = a.scene.add.graphics({ x: p.x, y: p.y }).setBlendMode('ADD');
  fire.fillStyle(color, 0.28).fillCircle(0, 0, radius);
  fire.lineStyle(size * 0.12, color, 0.95).strokeCircle(0, 0, radius);
  fire.lineStyle(size * 0.035, 0xfff4d4, 1).strokeCircle(0, 0, radius * 0.83);
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    fire.fillStyle(i % 2 ? color : 0xfff0bd, 0.85);
    fire.fillTriangle(
      0,
      0,
      Math.cos(angle - 0.05) * radius,
      Math.sin(angle - 0.05) * radius,
      Math.cos(angle + 0.05) * radius * 0.65,
      Math.sin(angle + 0.05) * radius * 0.65,
    );
  }
  fire.setScale(0.05);
  a.effect(fire, {
    scale: 1.15,
    alpha: { value: 0, ease: 'Cubic.easeIn' },
    rotation: 0.15,
    duration: 460,
    ease: 'Cubic.easeOut',
  });
  a.particles?.emitExplosion(p, { color, count: 24 });
}

function laser(a, node, color) {
  const p = a.position(node.index),
    size = a.cellSize;
  const width = a.boardCols * size,
    height = a.boardRows * size;
  const directions =
    node.type === 'row'
      ? [[1, 0]]
      : [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
  if (node.type === 'row') p.x = 0;
  if (node.diagonals) directions.push([1, 1], [-1, 1], [1, -1], [-1, -1]);
  for (const [dx, dy] of directions) {
    const reachX = dx > 0 ? width - p.x : dx < 0 ? p.x : Infinity;
    const reachY = dy > 0 ? height - p.y : dy < 0 ? p.y : Infinity;
    const reach = Math.min(reachX, reachY);
    const end = { x: p.x + dx * reach, y: p.y + dy * reach };
    const length = Math.hypot(end.x - p.x, end.y - p.y);
    const beam = a.scene.add.graphics({ x: p.x, y: p.y }).setBlendMode('ADD');
    beam.lineStyle(size * (node.width ?? 1) * 0.94, color, 0.24).lineBetween(0, 0, length, 0);
    for (
      let lane = -Math.floor((node.width ?? 1) / 2);
      lane <= Math.floor((node.width ?? 1) / 2);
      lane++
    ) {
      beam.lineStyle(size * 0.18, color, 0.85).lineBetween(0, lane * size, length, lane * size);
      beam.lineStyle(size * 0.045, 0xffffff, 0.95).lineBetween(0, lane * size, length, lane * size);
    }
    beam.setRotation(Math.atan2(dy, dx)).setScale(0.015, 1);
    a.effect(beam, {
      scaleX: 1,
      alpha: { value: 0, ease: 'Cubic.easeIn' },
      duration: 440,
      ease: 'Cubic.easeOut',
    });
    comet(a, p, end, color, 220);
  }
  a.particles?.emitExplosion(p, { color, count: 12 });
}

export async function playFusionPayload(a, combo, center) {
  const generation = a.generation;
  let nodes = combo.nodes ?? [];
  if (combo.key === 'rainbow+rainbow') {
    nodes = Array.from({ length: a.boardRows }, (_, row) => ({
      index: row * a.boardCols,
      type: 'row',
    }));
  }
  // Sample network origins, not clear targets. Every target still receives damage.
  const stride = Math.max(1, Math.ceil(nodes.length / 8));
  const visible = nodes.filter((_, i) => i % stride === 0);
  const network = combo.key.includes('rainbow');
  await Promise.all(
    visible.map(async (node, i) => {
      await a.tween({ phase: 0 }, { phase: 1, duration: 40 + i * 38 });
      if (generation !== a.generation) return;
      const color = network ? COLORS[i % COLORS.length] : i % 2 ? combo.accent : combo.color;
      if (network && node.type !== 'row') {
        comet(a, center, a.position(node.index), color, 150);
        await a.tween({ phase: 0 }, { phase: 1, duration: 150 });
        if (generation !== a.generation) return;
      }
      if (node.type === 'bomb') blast(a, node, color);
      else laser(a, node, color);
    }),
  );
  if (generation !== a.generation) return;
  await a.tween({ phase: 0 }, { phase: 1, duration: 90 });
}
