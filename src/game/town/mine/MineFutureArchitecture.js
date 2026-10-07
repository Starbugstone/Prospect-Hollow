import { FUTURE_PALETTES } from '../../../data/futureArchitecture';
import { futureShape } from '../buildings/futureShapes';

// Each later era crowns the portal with its own small signature in place of the
// cozy petal canopy, so every era transition visibly rebuilds the mine. Parts sit
// above the portal lintel; the decline, railway bore and forecourt stay clear. A
// few low-poly parts keep the mine within its static triangle budget.
export const FUTURE_MINE_CROWNS = {
  // Skysail: two masts carry a saffron sail and pennants over the entrance.
  'sail-arch'(d, entry) {
    const p = FUTURE_PALETTES.sail;
    for (const x of [-1.55, 1.55]) {
      d.box(entry, 0.09, 1.9, 0.09, x, 3.3, 0.1, p.timber);
      d.mesh(entry, futureShape(d, 'pennant'), [0.5, 0.28, 1], [x, 3.95, 0.1], p.flower);
    }
    const sail = d.box(entry, 3.2, 0.04, 1.15, 0, 3.55, 0.25, p.flower);
    sail.rotation.x = 0.28;
    sail.name = 'Mine sailcloth canopy';
  },
  // Stargazer: a copper-ringed dome with a little telescope.
  'dome-arch'(d, entry) {
    const p = FUTURE_PALETTES.observatory;
    d.mesh(entry, futureShape(d, 'octagon'), [0.62, 0.3, 0.62], [0, 2.95, 0.05], p.roof);
    const dome = d.mesh(
      entry,
      futureShape(d, 'lowDome'),
      [0.58, 0.58, 0.58],
      [0, 3.1, 0.05],
      p.shell,
    );
    dome.name = 'Mine observatory dome';
    const scope = d.box(entry, 0.14, 0.7, 0.14, 0.12, 3.62, 0.3, p.timber);
    scope.rotation.x = 0.6;
  },
  // Moonward: a solar-shingle gable and a gold landing beacon for the supply run.
  'homestead-arch'(d, entry) {
    const p = FUTURE_PALETTES.homestead;
    const gable = d.mesh(
      entry,
      futureShape(d, 'gable'),
      [3.5, 0.85, 1.25],
      [0, 2.78, 0.12],
      p.roof,
    );
    gable.name = 'Mine homestead gable';
    d.box(entry, 0.07, 1.5, 0.07, 1.45, 3.55, -0.2, p.deep);
    d.ball(entry, 1.45, 4.35, -0.2, 0.13, p.light, 'rock');
  },
};
