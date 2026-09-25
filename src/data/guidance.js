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
};
const firstUnseen = (ids, seen = []) => {
  const id = ids.find((id) => id && !seen.includes(id));
  return id ? { id, text: tips[id] } : null;
};
export function townTip(campaign) {
  const town = campaign.town;
  if (town.tourSeen) return null;
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
      game.board.some((_, i) => bonus(i)) && 'bonus',
      adjacent && 'fusion',
      campaign.powers.some((power) => power.quantity > 0) && 'powers',
    ],
    campaign.seenTips,
  );
}
