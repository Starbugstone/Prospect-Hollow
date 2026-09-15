import { eraEvolution } from '../../data/eras';
import { cityModel } from './buildings/city';
export function addMineEra(d, parent, era = 'frontier') {
  const style = eraEvolution(era).style;
  if (style === 'frontier') return;
  if (style === 'city') {
    cityModel(d, parent, `${era}-mine`);
    return;
  }
  const root = d.group(parent);
  root.name = `${era} mine entrance`;
  if (style === 'river-rail') {
    d.mesh(root, 'cylinder', [0.48, 1.5, 0.48], [-2, 0.8, 0.8], '#8e7860');
    d.rod(root, [-2, 1.5, 0.8], [-2, 3.5, 0.8], 0.12, '#65756c');
    for (const x of [-1, 1]) d.box(root, 0.32, 2.5, 0.35, x, 1.25, 0.9, '#9b7954');
    d.box(root, 2.8, 0.3, 0.65, 0, 2.6, 0.85, '#66887f');
  } else {
    const motor = style === 'motor-age';
    for (const x of [-1.15, 1.15]) {
      d.box(root, 0.42, 2.85, 0.55, x, 1.42, 0.9, motor ? '#ddcca8' : '#9ba89a');
      d.box(root, 0.22, 0.55, 0.16, x, 2, 1.22, '#ffebad');
    }
    d.box(root, 3, 0.5, 0.8, 0, 2.95, 0.85, motor ? '#d9c6a1' : '#607b74');
    if (motor) {
      d.box(root, 3.4, 0.17, 1.25, 0, 2.6, 1.05, '#648e8b');
      d.box(root, 1.7, 0.45, 0.4, 0, 3.4, 0.9, '#ddcca8');
      for (const x of [-1.9, 1.9]) {
        d.box(root, 0.7, 0.45, 0.8, x, 0.3, 1.6, '#c6b999');
        d.ball(root, x, 0.7, 1.6, [0.45, 0.35, 0.4], '#859e76');
      }
    } else {
      d.box(root, 0.75, 1.45, 0.7, -2, 0.78, 0.9, '#859990');
      d.box(root, 0.45, 0.45, 0.08, -2, 1.08, 1.28, '#edcf79');
      d.rod(root, [-2, 1.5, 0.9], [-1.15, 2.95, 0.9], 0.04, '#566a63');
    }
  }
}
