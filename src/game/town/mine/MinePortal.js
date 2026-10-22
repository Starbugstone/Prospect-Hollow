import { mineAppearance, mineProfile } from '../../../data/mineEvolution';
import { MINE_POSITION, MINE_SHAFT } from '../../../data/mineSite';
import { ROUNDED_PALETTE } from '../../../data/roundedArchitecture';
import { addCozyMinePortal } from './MineCozyArchitecture';
import { FUTURE_MINE_CROWNS } from './MineFutureArchitecture';
import { MINE_SIGN_BOARDS, mineSignMountFor } from './MineSignCatalog';

// This assembly is also the sign catalog's source. The historic board is resolved
// at its original point in construction, before the remaining portal and yard.
export function addMinePortal(
  d,
  root,
  era,
  profile = mineProfile(era),
  appearance = mineAppearance(era),
) {
  const entry = d.group(
    root,
    0,
    MINE_SHAFT.portalFloor - 0.08,
    MINE_SHAFT.portalZ - MINE_POSITION[1],
  );
  entry.name = `Mine portal ${profile.portal}`;
  entry.userData.buildPhase = 1;
  const timber = profile.portal === 'timber',
    wall = timber ? '#aa8053' : appearance.wall;
  for (const x of [-1.25, 1.25]) d.box(entry, 0.3, 2.35, 0.48, x, 1.18, 0, wall);
  d.box(entry, timber ? 2.85 : 3.15, 0.3, 0.6, 0, 2.36, 0, wall);
  if (!timber) {
    d.box(entry, 0.34, 0.45, 0.08, 0, 2.32, 0.35, '#d3c7a4');
    if (profile.heritage.includes('keystone-1884')) {
      const plaque = d.box(entry, 0.42, 0.23, 0.06, 0, 2.37, 0.42, '#bdac82');
      plaque.name = '1884 keystone';
      entry.userData.generatedSignMount = mineSignMountFor(MINE_SIGN_BOARDS.portal, era, entry);
      d.sign?.(entry, '1884', 0.42, 0, 2.37, 0.45);
    }
    for (const x of [-1.25, 1.25]) d.box(entry, 0.14, 0.28, 0.1, x, 1.7, 0.3, '#f5d38c');
  }
  if (
    ['stepped-cream', 'ribbon-control', 'glazed-tower', 'solar-industrial'].includes(profile.portal)
  ) {
    d.box(entry, 3.7, 0.16, 1.1, 0, 2.55, 0.25, appearance.roof);
    d.box(
      entry,
      profile.portal === 'glazed-tower' ? 1.6 : 2.5,
      0.5,
      0.5,
      0,
      2.92,
      0,
      appearance.wall,
    );
    if (profile.portal !== 'stepped-cream') d.box(entry, 2.1, 0.3, 0.06, 0, 2.95, 0.28, '#517a86');
  }
  if (profile.portal === 'rounded-arch') {
    // A glazed half-dome hood shelters the entrance in rounded eras.
    d.ball(entry, 0, 2.5, 0.1, [1.9, 0.85, 0.75], ROUNDED_PALETTE.glass);
  }
  const crown = FUTURE_MINE_CROWNS[profile.portal];
  if (crown) crown(d, entry);
  else if (appearance.cozyStyle) addCozyMinePortal(d, entry, appearance);
  return entry;
}
