import { defineStore } from 'pinia';
import { useGameStore } from './gameStore';
import { useCampaignStore } from './campaignStore';
import { POWERS } from '../data/campaign';

// Powers that wait for a board tap; they are consumed on that tap.
export const TARGETED_POWERS = new Set(
  POWERS.filter((power) => power.targeted).map(({ id }) => id),
);

export const useInventoryStore = defineStore('inventory', {
  getters: {
    quickAccessSlots: () => useCampaignStore().powers,
  },
  actions: {
    availableQuantity(id) {
      const slot = this.quickAccessSlots.find((entry) => entry.id === id);
      return Math.max(0, (slot?.quantity ?? 0) - Number(useGameStore().powerInUse === id));
    },
    async usePowerUp(id) {
      const gameStore = useGameStore();
      if (!gameStore.sessionActive || gameStore.levelCleared || gameStore.inputPaused) return false;
      if (this.availableQuantity(id) <= 0) return false;
      if (TARGETED_POWERS.has(id)) return gameStore.setBonusMode(id);
      gameStore.setBonusMode(null);
      if (id === 'clear-row') return gameStore.activateOneTimeBonus('clear-row', { consume: true });
      // The shuffle spends the item before its resolution can finish the puzzle.
      if (id !== 'shuffle' || !(await gameStore.shuffleBoard({ consume: id }))) return false;
      await gameStore.ensurePlayableBoard();
      return true;
    },
    consumeItem(id) {
      return useCampaignStore().consumePowerItem(id);
    },
  },
});
