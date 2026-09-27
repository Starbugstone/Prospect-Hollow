import { mineProfile, MINE_PROFILES } from './mineProfiles';

// Surface equipment is independent of puzzle progress and has no gameplay cost.
// The era's existing art family also lets future eras inherit a supported mine.
const STYLES = {
  frontier: { height: 1.5, frame: '#a38252', wall: '#b18d61', roof: '#78938a', machine: 'hand' },
  'river-rail': {
    height: 3.3,
    frame: '#9b7954',
    wall: '#ae9270',
    roof: '#66887f',
    machine: 'steam',
  },
  industrial: {
    height: 4.4,
    frame: '#607b74',
    wall: '#ad795d',
    roof: '#526b65',
    machine: 'electric',
  },
  'post-war': {
    height: 4.8,
    frame: '#638b88',
    wall: '#b79078',
    roof: '#638b88',
    machine: 'enclosed',
  },
  'motor-age': {
    height: 5.1,
    frame: '#648d89',
    wall: '#ddcca8',
    roof: '#648e8b',
    machine: 'motor',
  },
  aviation: { height: 5.5, frame: '#648d89', wall: '#e1cfab', roof: '#648d89', machine: 'radio' },
  broadcast: {
    height: 5.9,
    frame: '#526775',
    wall: '#c9c1ad',
    roof: '#526775',
    machine: 'control',
  },
  contemporary: {
    height: 6.2,
    frame: '#648d89',
    wall: '#ddd1ae',
    roof: '#638b88',
    machine: 'digital',
  },
};
export function mineAppearance(era) {
  const profile = mineProfile(era);
  const key = Object.keys(STYLES).find((key) => MINE_PROFILES[key].works === profile.works);
  return Object.hasOwn(STYLES, key) ? STYLES[key] : STYLES.frontier;
}

export const ERA_CONSTRUCTION = Object.freeze({
  duration: 22,
  reveal: 6,
  buildStart: 6,
  buildEnd: 16,
  leave: 18,
});

export { MINE_PROFILES, mineProfile, validateMineProfiles } from './mineProfiles';
