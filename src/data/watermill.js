import { eraEvolution } from './eras';

export const WATERMILL_SITE = Object.freeze({
  position: Object.freeze([21.5, -12]),
  wheelX: 2.35,
  axleHeight: 0.85,
  wheelRadius: 1.37,
});

// Shared by construction offers, the diorama and the accessible drawing. New eras
// inherit their style and capabilities, including unknown-era Frontier fallback.
const STYLES = {
  frontier: [
    '#b58a58',
    '#6b8170',
    'Timber watermill',
    'Timber beams and a wooden wheel beside the river.',
  ],
  'river-rail': [
    '#ab735c',
    '#526e79',
    'Masonry watermill',
    'Brick walls, a slate roof and an iron-bound waterwheel.',
  ],
  industrial: [
    '#976650',
    '#566f69',
    'Industrial watermill',
    'A brick engine house and steel fittings preserve the working wheel.',
  ],
  'motor-age': [
    '#ddcba6',
    '#648e8b',
    'Valley watermill',
    'Cream walls and a broad teal canopy shelter the familiar mill.',
  ],
  city: [
    '#c7b696',
    '#687f79',
    'Heritage watermill',
    'The restored waterwheel anchors a renewed riverside landmark.',
  ],
};
export function watermillAppearance(era) {
  const profile = eraEvolution(era);
  const [wall, roof, name, description] = STYLES[profile.style] ?? STYLES.frontier;
  return {
    wall: profile.digitalCity ? '#d2dbcb' : profile.tallCity ? '#a8bbc0' : wall,
    roof: profile.digitalCity ? '#547f75' : profile.detailAsset ? '#668c9a' : roof,
    name,
    description,
    masonry: profile.style !== 'frontier',
    electric: profile.electricity,
    streamlined: profile.style === 'motor-age',
    city: profile.style === 'city',
    aerial: !!profile.detailAsset,
    tall: profile.tallCity,
    solar: profile.digitalCity,
  };
}
