import { defineStore } from 'pinia';
import { useGameStore } from './gameStore';

import { useCampaignStore } from './campaignStore';

export const useInventoryStore = defineStore('inventory', {
  getters: {
    quickAccessSlots: () => useCampaignStore().powers,
  },
  actions: {
    availableQuantity(id) {
      const inventoryId = id.replaceAll('_', '-');
      const quantity =
        this.quickAccessSlots.find((entry) => entry.id === inventoryId)?.quantity ?? 0;
      return Math.max(0, quantity - Number(useGameStore().powerInUse === inventoryId));
    },
    async usePowerUp(id) {
      const gameStore = useGameStore();
      if (!gameStore.sessionActive || gameStore.levelCleared || gameStore.inputPaused) return false;
      const slot = this.quickAccessSlots.find((entry) => entry.id === id);
      if (!slot || this.availableQuantity(id) <= 0) {
        return false;
      }

      if (slot.disabled) {
        console.warn(`Power-up ${slot.label} is currently disabled.`);
        return false;
      }

      let powerUpExecuted = false;
      let consumeImmediately = true;

      try {
        switch (id) {
          case 'clear-row':
            gameStore.setBonusMode(null); // Ensure other interactive bonuses toggle off
            powerUpExecuted = await gameStore.activateOneTimeBonus('clear_row', { consume: true });
            consumeImmediately = false;
            break;
          case 'shuffle':
            {
              gameStore.setBonusMode(null); // Clear other bonus selections
              const result = await gameStore.shuffleBoard();
              if (result !== false) {
                await gameStore.ensurePlayableBoard();
              }
              powerUpExecuted = result !== false;
            }
            break;
          case 'tnt':
          case 'color-wand':
          case 'tile-breaker':
            // Map inventory IDs to internal bonus names
            const bonusModeMap = {
              tnt: 'tnt',
              'color-wand': 'color_wand',
              'tile-breaker': 'tile_breaker',
            };
            powerUpExecuted = gameStore.setBonusMode(bonusModeMap[id]);
            consumeImmediately = false; // Will be consumed upon successful board interaction
            break;
          default:
            console.warn(`Power-up ${id} not implemented.`);
        }
      } catch (error) {
        console.error(`Failed to execute power-up ${id}`, error);
        throw error;
      }

      if (powerUpExecuted && consumeImmediately) {
        slot.quantity -= 1;
        useCampaignStore().save();
        return true;
      }

      return powerUpExecuted;
    },
    consumeItem(id) {
      const inventoryId = id.replaceAll('_', '-');
      const slot = this.quickAccessSlots.find((entry) => entry.id === inventoryId);

      if (slot && slot.quantity > 0) {
        slot.quantity -= 1;
        useCampaignStore().save();
        return true;
      }
      return false;
    },
    /**
     * Award a power to the inventory (e.g., from lootbox)
     * @param {string} powerId - The power ID to award
     * @param {number} quantity - How many to award (default: 1)
     * @returns {boolean} True if power was found and awarded
     */
    awardPower(powerId, quantity = 1) {
      if (!Number.isSafeInteger(quantity) || quantity <= 0) return false;
      const slot = this.quickAccessSlots.find((entry) => entry.id === powerId);
      if (slot) {
        return !!useCampaignStore().awardReward({
          id: slot.id,
          label: slot.label,
          kind: 'power',
          quantity,
        });
      }
      console.warn(`Cannot award unknown power: ${powerId}`);
      return false;
    },
  },
});
