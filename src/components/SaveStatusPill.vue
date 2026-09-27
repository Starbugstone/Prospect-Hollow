<template>
  <div ref="root" class="save-pill-wrap" @keydown.esc="open = false">
    <button
      class="save-pill"
      :data-tone="state.tone"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="t('Save status: {status}', { status: t(state.label) })"
      :title="t(state.label)"
      @click="toggle"
    >
      <span class="save-pill-led" aria-hidden="true"></span>
      <GameIcon
        :name="state.tone === 'local' ? 'phone' : 'cloud'"
        :class="{ 'save-pill-cloud': state.tone !== 'local' }"
      />
      <span class="save-pill-label">{{ t(state.label) }}</span>
    </button>
    <div v-if="open" class="save-pill-pop" role="dialog" :aria-label="t('Save status')">
      <div class="save-pill-head">
        <img src="/art/amethyst.svg" alt="" />
        <span
          ><strong>{{ account.townName.value }}</strong
          ><small>{{ subtitle }}</small></span
        >
      </div>
      <p>{{ t(state.detail) }}</p>
      <button
        v-if="primary"
        class="save-pill-primary"
        :disabled="primary.disabled"
        @click="run(primary.run)"
      >
        {{ t(primary.label) }}
      </button>
      <button
        v-if="account.signedIn.value && state.action !== 'my-towns'"
        :disabled="!account.canOpen.value"
        @click="run(account.open)"
      >
        {{ t('My towns') }}
      </button>
    </div>
  </div>
</template>
<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { timeAgo } from '../services/saveStatus';
import GameIcon from './GameIcon.vue';
import { t } from '../i18n';
// Provided by CloudRoot; the parent renders this pill only when it exists.
const account = inject('cloudAccount');
const open = ref(false),
  root = ref(null),
  now = ref(Date.now());
const state = computed(() => account.saveState.value);
const subtitle = computed(() => {
  if (!account.accountTown.value) return t('Only on this device');
  const ago = timeAgo(account.cloudAt.value, now.value);
  return ago ? t('Backed up {time}', { time: ago }) : t('Not backed up yet');
});
const ACTIONS = {
  'sign-in': () => ({
    label: account.signedIn.value ? 'Sign in again' : 'Protect my progress',
    run: account.open,
    disabled: !account.canOpen.value,
  }),
  'my-towns': () => ({ label: 'My towns', run: account.open, disabled: !account.canOpen.value }),
  retry: () => ({ label: 'Back up now', run: account.sync, disabled: !account.canSync.value }),
  compare: () => ({
    label: 'Compare saves',
    run: account.openRecovery,
    disabled: !account.canReview.value,
  }),
};
const primary = computed(() => ACTIONS[state.value.action]?.() ?? null);
function toggle() {
  now.value = Date.now();
  open.value = !open.value;
}
function run(action) {
  open.value = false;
  action();
}
function outside(event) {
  if (!root.value?.contains(event.target)) open.value = false;
}
watch(open, (visible) => {
  if (visible) document.addEventListener('pointerdown', outside, true);
  else document.removeEventListener('pointerdown', outside, true);
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside, true));
</script>
<style scoped>
.save-pill-wrap {
  position: relative;
}
.save-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 6px 12px;
  border: 1px solid #cfc3a0;
  border-radius: 10px;
  background: #fff9e9ee;
  color: #405b4c;
  font: 700 13px system-ui;
  cursor: pointer;
}
.save-pill svg {
  width: 17px;
  height: 17px;
}
.save-pill[data-tone='alert'] {
  border-color: #e0b75b;
  background: #fff1cf;
  color: #7a5412;
}
.save-pill-led {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #a1a99a;
}
[data-tone='saved'] > .save-pill-led {
  background: #3f9a5a;
  box-shadow: 0 0 0 3px #3f9a5a2e;
}
[data-tone='busy'] > .save-pill-led,
[data-tone='pending'] > .save-pill-led {
  background: #e39a1f;
  box-shadow: 0 0 0 3px #e39a1f33;
}
[data-tone='alert'] > .save-pill-led {
  background: #d25a3c;
  box-shadow: 0 0 0 3px #d25a3c33;
}
[data-tone='local'] > .save-pill-led {
  display: none;
}
.save-pill-pop {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 20;
  width: min(300px, calc(100vw - 32px));
  box-sizing: border-box;
  display: grid;
  gap: 10px;
  padding: 14px;
  background: #fffdf6;
  color: #294139;
  border: 1px solid #e3dbc7;
  border-radius: 14px;
  box-shadow: 0 16px 40px #18383233;
  font: 14px/1.45 system-ui;
  text-align: left;
}
.save-pill-pop p {
  margin: 0;
}
.save-pill-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.save-pill-head img {
  width: 28px;
  height: 28px;
}
.save-pill-head span {
  display: grid;
  min-width: 0;
}
.save-pill-head strong {
  font:
    17px Georgia,
    serif;
  overflow-wrap: anywhere;
}
.save-pill-head small {
  color: #64756a;
  font-size: 12px;
}
.save-pill-pop button {
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid #c9c3ad;
  border-radius: 999px;
  background: #fffdf6;
  color: #294139;
  font: 600 14px system-ui;
  cursor: pointer;
}
.save-pill-pop .save-pill-primary {
  background: #315940;
  border-color: #315940;
  color: #fffdf6;
}
.save-pill-pop button:disabled {
  opacity: 0.5;
  cursor: default;
}
.save-pill:focus-visible,
.save-pill-pop button:focus-visible {
  outline: 3px solid #ab813e;
  outline-offset: 2px;
}
.save-pill-cloud {
  display: none;
}
/* Narrow screens keep the icon and status light only. */
@media (max-width: 560px) {
  .save-pill-label {
    display: none;
  }
  .save-pill-cloud {
    display: block;
  }
}
</style>
