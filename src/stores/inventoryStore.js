import { defineStore } from 'pinia';
import { useGameStore } from './gameStore';
import { useCampaignStore } from './campaignStore';

// Powers that wait for a board tap, by inventory id; they are consumed on that tap.
const TARGETED_POWERS = Object.freeze({
  tnt: 'tnt',
  'color-wand': 'color_wand',
  'tile-breaker': 'tile_breaker',
});
// The mine names powers with underscores; the saved inventory uses hyphens.
const inventoryId = (id) => id.replaceAll('_', '-');

export const useInventoryStore = defineStore('inventory', {
  getters: {
    quickAccessSlots: () => useCampaignStore().powers,
  },
  actions: {
    availableQuantity(id) {
      const slot = this.quickAccessSlots.find((entry) => entry.id === inventoryId(id));
      return Math.max(
        0,
        (slot?.quantity ?? 0) - Number(useGameStore().powerInUse === inventoryId(id)),
      );
    },
    async usePowerUp(id) {
      const gameStore = useGameStore();
      if (!gameStore.sessionActive || gameStore.levelCleared || gameStore.inputPaused) return false;
      if (this.availableQuantity(id) <= 0) return false;
      if (TARGETED_POWERS[id]) return gameStore.setBonusMode(TARGETED_POWERS[id]);
      gameStore.setBonusMode(null);
      if (id === 'clear-row') return gameStore.activateOneTimeBonus('clear_row', { consume: true });
      if (id !== 'shuffle' || (await gameStore.shuffleBoard()) === false) return false;
      await gameStore.ensurePlayableBoard();
      return this.consumeItem(id);
    },
    consumeItem(id) {
      const slot = this.quickAccessSlots.find((entry) => entry.id === inventoryId(id));
      if (!slot || slot.quantity <= 0) return false;
      slot.quantity -= 1;
      useCampaignStore().save();
      return true;
    },
  },
});
