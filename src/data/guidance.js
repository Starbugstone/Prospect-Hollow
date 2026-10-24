import { constructionReady, upgradeOffer } from '../game/town/TownRules';

// Contextual tips share one persistence contract. Full guides remain available in Help.
export const TIP_IDS = [
  'well',
  'mine',
  'happiness',
  'savings',
  'supplies',
  'ice',
  'bonus',
  'fusion',
  'powers',
  'orders',
];
const tips = {
  well: 'Build a well — your first building is free.',
  mine: 'Play the mine to earn coins for your village.',
  happiness: 'Town square upgrades improve happiness and saloon income.',
  savings: 'The sheriff and bank protect your savings from raids.',
  supplies: 'Buy supplies at the shop to use in the mine.',
  ice: 'Match 3 gems on frosted tiles to clear the ice. There is no move limit.',
  bonus: 'You made a bonus gem! Swipe it or double-tap it to set it off.',
  fusion: 'Swap neighboring bonus gems to combine their effects.',
  powers: 'Your power-ups are below the board. Choose one to use it.',
  orders: 'Only the ore orders are left. Collect the pictured gems to finish the level.',
};
const firstUnseen = (ids, seen = []) => {
  const id = ids.find((id) => id && !seen.includes(id));
  return id ? { id, text: tips[id] } : null;
};
// A town this far along has found its way around; the tutorial stays out of its way.
export const TUTORIAL_PUZZLE_LIMIT = 12;
// The village tutorial walks a new town through its first buildings one tap at a time.
// Each step follows from the town itself, so it resumes after a reload or a puzzle and
// needs no save field of its own: `town.tourSeen` records that it is finished or skipped.
// A step points at a plot on the map or a tab of the village bar.
export function villageTutorial(campaign) {
  const town = campaign.town;
  if (
    town.tourSeen ||
    campaign.readOnly ||
    town.era !== 'frontier' ||
    campaign.completedCount > TUTORIAL_PUZZLE_LIMIT
  )
    return null;
  const built = (id) => town.buildings[id] > 0;
  const mine = (id, text) => ({ id, text, target: { tab: 'mine' } });
  // Short of coins for the next building, the mine is the step that leads to it.
  const plot = (id, text, earn) => {
    const offer = upgradeOffer(town, id);
    return offer?.available && town.coins < offer.cost
      ? mine(`${id}-coins`, earn)
      : { id, text, target: { plot: id } };
  };
  const saloon = town.projects.saloon;
  if (!Object.values(town.buildings).some(Boolean) && !Object.keys(town.projects).length)
    return {
      id: 'well',
      text: 'Welcome to Prospect Hollow! Tap the well to start your town. Your first building is free.',
      target: { plot: 'well' },
    };
  if (!campaign.completedCount)
    return mine(
      'mine',
      'Fresh water at last! Coins come from the mine. Tap Mine to play a puzzle.',
    );
  if (!built('farm'))
    return plot(
      'farm',
      'You earned coins! Tap the farm to grow food for new neighbors.',
      'Play another puzzle to earn coins for the farm.',
    );
  if (!built('home'))
    return plot(
      'home',
      'Now tap the house. A family moves in once there is water and food.',
      'Play another puzzle to earn coins for the house.',
    );
  if (!built('saloon') && !saloon)
    return plot(
      'saloon',
      'Bigger buildings take a puzzle to build. Tap the saloon to start it.',
      'Play another puzzle to earn coins for the saloon.',
    );
  if (saloon && !constructionReady(saloon))
    return mine(
      'construction',
      'Every puzzle you finish builds what is under construction. Play one to raise the saloon.',
    );
  if (saloon)
    return {
      id: 'finish',
      text: 'The saloon is ready! Tap it to open its doors.',
      target: { plot: 'saloon' },
    };
  return {
    id: 'next',
    text: 'Well done! Build always shows your next step. Tap it whenever you are unsure.',
    target: { tab: 'build' },
  };
}
export function townTip(campaign) {
  const town = campaign.town;
  if (villageTutorial(campaign)) return null;
  return firstUnseen(
    [
      !Object.values(town.buildings).some(Boolean) && !Object.keys(town.projects).length && 'well',
      (Object.values(town.buildings).some(Boolean) || Object.keys(town.projects).length > 0) &&
        campaign.completedCount === 0 &&
        'mine',
      town.buildings.home > 0 && 'happiness',
      town.buildings.home > 0 && campaign.completedCount >= 3 && 'savings',
      campaign.shopVisit > 0 && 'supplies',
    ],
    campaign.seenTips,
  );
}
const bonusTypes = new Set(['bomb', 'rainbow', 'cross']);
export function mineTip(game, campaign) {
  if (!game.sessionActive || game.levelCleared) return null;
  const bonus = (index) => bonusTypes.has(game.board[index]?.type);
  const adjacent = game.board.some(
    (_, i) =>
      bonus(i) &&
      ((i % game.boardCols < game.boardCols - 1 && bonus(i + 1)) || bonus(i + game.boardCols)),
  );
  return firstUnseen(
    [
      game.currentLevelId === 1 &&
        game.moves === 0 &&
        !campaign.seenObstacles.includes('ice') &&
        'ice',
      game.remainingOre > 0 &&
        game.totalLayers + game.totalRelics > 0 &&
        !game.remainingLayers &&
        !game.remainingRelics &&
        'orders',
      game.board.some((_, i) => bonus(i)) && 'bonus',
      adjacent && 'fusion',
      campaign.powers.some((power) => power.quantity > 0) && 'powers',
    ],
    campaign.seenTips,
  );
}
