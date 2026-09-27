<template>
  <dialog
    ref="dialog"
    class="mock-ad"
    :aria-label="t('Advertising preview')"
    @cancel.prevent="ads.settleMock('dismissed')"
  >
    <p class="mock-ad-label">{{ t('LOCAL AD PREVIEW') }}</p>
    <h2>{{ t('A little break at Prospect Hollow') }}</h2>
    <img src="/art/amethyst.svg" alt="" />
    <p>{{ t('This is a test placeholder. No advertiser is contacted.') }}</p>
    <div class="mock-ad-actions">
      <button
        @click="
          ads.settleMock(adState.mockPresentation?.format === 'rewarded' ? 'rewarded' : 'shown')
        "
      >
        {{ t(adState.mockPresentation?.format === 'rewarded' ? 'Complete test ad' : 'Continue') }}
      </button>
      <button @click="ads.settleMock('dismissed')">{{ t('Close without reward') }}</button>
    </div>
    <details>
      <summary>{{ t('Test other outcomes') }}</summary>
      <button @click="ads.settleMock('no-fill')">{{ t('No ad available') }}</button>
      <button @click="ads.settleMock('error')">{{ t('Ad error') }}</button>
    </details>
  </dialog>
</template>
<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../i18n';
import { useAdvertising } from '../composables/useAdvertising';
const { ads, adState } = useAdvertising();
const dialog = ref(null);
watch(
  () => adState.value.mockPresentation,
  async (presentation) => {
    await nextTick();
    if (presentation) dialog.value?.showModal();
    else dialog.value?.close();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (adState.value.mockPresentation) ads.settleMock('dismissed');
});
</script>
<style scoped>
.mock-ad {
  width: min(440px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 28px;
  border: 2px solid #bfa56f;
  border-radius: 20px;
  background: #211a32;
  color: #fff0d1;
  text-align: center;
}
.mock-ad::backdrop {
  background: #100b20ec;
}
.mock-ad-label {
  font-size: 11px;
  letter-spacing: 2px;
  color: #e0c18a;
}
h2 {
  margin-block: 16px;
  font-size: 26px;
}
img {
  width: 86px;
  margin: 18px;
}
p {
  line-height: 1.6;
}
.mock-ad-actions {
  display: grid;
  gap: 10px;
  margin-block: 20px;
}
button {
  min-height: 44px;
  padding: 10px;
  border: 1px solid #bfa56f;
  border-radius: 8px;
  background: #433352;
  color: #fff0d1;
}
summary {
  padding: 12px;
  cursor: pointer;
}
details button {
  margin: 4px;
}
</style>
