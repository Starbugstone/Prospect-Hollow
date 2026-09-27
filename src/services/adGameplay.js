import { townStorage } from './townStorage';
import { AD_POLICY } from '../data/advertising';

// The provider reports outcomes; only these callers may apply optional benefits.
export function canOfferRewardedShuffle(game, campaign, inventory) {
  return (
    game.sessionActive &&
    game.playMode === 'normal' &&
    !game.levelCleared &&
    !campaign.readOnly &&
    inventory.availableQuantity('shuffle') === 0 &&
    (campaign.advertising.lastShuffleRun !== game.runId ||
      campaign.advertising.shuffleCount < AD_POLICY.shufflesPerRun)
  );
}

export function canRewardShuffle(game, campaign, inventory) {
  return (
    canOfferRewardedShuffle(game, campaign, inventory) &&
    !game.animationInProgress &&
    !game.inputPaused &&
    !game.activeBonusMode &&
    game._hasPlayableMove()
  );
}

export async function rewardManualShuffle({ game, campaign, inventory, ads }) {
  if (
    !canRewardShuffle(game, campaign, inventory) ||
    !ads.isAvailable('rewarded', 'manual-shuffle')
  )
    return false;
  const runId = game.runId,
    version = game.sessionVersion,
    town = townStorage.selectedKey();
  const outcome = await ads.showRewarded('manual-shuffle');
  if (
    !outcome.rewarded ||
    version !== game.sessionVersion ||
    runId !== game.runId ||
    town !== townStorage.selectedKey() ||
    !canRewardShuffle(game, campaign, inventory) ||
    !campaign.reserveAdShuffle(runId)
  )
    return false;
  const shuffled = await game.shuffleBoard();
  if (shuffled && version === game.sessionVersion) await game.ensurePlayableBoard();
  return !!shuffled;
}

export async function rewardBonusChest({ game, campaign, ads }) {
  const runId = game.runId,
    levelId = game.currentLevelId;
  if (
    !game.levelCleared ||
    game.playMode !== 'normal' ||
    !campaign.canOfferAdChest(runId) ||
    !ads.isAvailable('rewarded', 'bonus-chest')
  )
    return null;
  const version = game.sessionVersion,
    town = townStorage.selectedKey();
  const outcome = await ads.showRewarded('bonus-chest');
  if (
    !outcome.rewarded ||
    version !== game.sessionVersion ||
    !game.levelCleared ||
    runId !== game.runId ||
    town !== townStorage.selectedKey()
  )
    return null;
  return campaign.grantAdChest(runId, levelId);
}
