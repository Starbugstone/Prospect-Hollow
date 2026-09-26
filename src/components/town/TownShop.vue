<template>
  <section class="town-service">
    <h3>{{ t('Today’s supplies') }}</h3>
    <p>
      {{
        t(
          'One of each item. Stock refreshes after each completed mine run. Upgrade the shop for more choice.',
        )
      }}
    </p>
    <div class="shop-shelves">
      <button
        v-for="offer in offers"
        :key="`${campaign.shopVisit}-${offer.id}`"
        class="shop-item"
        :disabled="!!offer.reason"
        :aria-label="
          t('Buy {item} for {price} coins', { item: t(offer.label), price: offer.price })
        "
        @click="buy(offer)"
      >
        <img :src="rewardArt(offer)" alt="" /><strong>{{ t(offer.label) }}</strong>
        <span>{{ t(offer.reason || '{price} coins', { price: offer.price }) }}</span>
      </button>
    </div>
    <p role="status">{{ t(notice || 'Tap an item to buy it.') }}</p>
  </section>
</template>
<script setup>
import { computed, ref, onMounted } from 'vue';
import { t } from '../../i18n';
import { SHOP_ITEMS, shopSpace } from '../../data/shop';
import { rewardArt } from '../../data/rewards';
import { useCampaignStore } from '../../stores/campaignStore';
const campaign = useCampaignStore(),
  notice = ref('');
onMounted(() => {
  campaign.ensureShopStock();
  campaign.save();
});
const offers = computed(() =>
  campaign.shopStock.map((offer) => {
    const item = SHOP_ITEMS.find((entry) => entry.id === offer.id);
    return {
      ...item,
      visit: campaign.shopVisit,
      reason: offer.sold
        ? 'Sold out'
        : shopSpace(campaign, item) <= 0
          ? 'Storage full'
          : campaign.town.coins < item.price
            ? 'Not enough coins'
            : '',
    };
  }),
);
async function buy(item) {
  if (await campaign.buyShopItem(item.id, item.visit))
    notice.value = t('{item} added to your supplies.', { item: t(item.label) });
}
</script>
<style scoped>
.shop-shelves {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}
.shop-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  border: 1px solid #c1b897;
  border-radius: 12px;
  background: #fff9e9;
  color: #465c4e;
}
.shop-item img {
  width: 62px;
  height: 62px;
}
.shop-item span {
  font-size: 12px;
}
.shop-item:disabled {
  opacity: 0.55;
}
.shop-item:not(:disabled):hover {
  border-color: #567b62;
  background: #eff1da;
}
</style>
