<template>
  <div ref="root" class="save-pill-wrap" @keydown.esc.stop="close(true)" @focusout="leave">
    <button
      class="save-pill"
      ref="trigger"
      :data-tone="state.tone"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="
        t('{town}, save status: {status}', {
          town: account.townName.value,
          status: t(state.label),
        })
      "
      :title="t('Town & saves')"
      @click="toggle"
    >
      <span class="save-pill-led" aria-hidden="true"></span>
      <GameIcon
        :name="state.tone === 'local' ? 'phone' : 'cloud'"
        :class="{ 'save-pill-cloud': state.tone !== 'local' }"
      />
      <span class="save-pill-town">{{ account.townName.value }}</span>
      <span class="save-pill-label">{{ t(state.label) }}</span>
      <GameIcon class="save-pill-chevron" name="chevron" />
    </button>
    <div
      v-if="introVisible"
      class="save-pill-pop save-pill-intro"
      role="dialog"
      :aria-label="t('Discover your town menu')"
    >
      <button class="save-pill-close" :aria-label="t('Dismiss')" @click="dismissIntro">
        <GameIcon name="close" />
      </button>
      <small class="save-pill-kicker">{{ t('There’s more to your town') }}</small>
      <strong class="save-pill-intro-title">{{ t('Save it. Share it. Explore.') }}</strong>
      <p>
        {{ t('Tap your town name to save online, share your town and visit other mayors.') }}
      </p>
      <div class="save-pill-intro-actions">
        <button class="save-pill-primary" @click="toggle">{{ t('Show me') }}</button>
        <button @click="dismissIntro">{{ t('Later') }}</button>
      </div>
    </div>
    <div v-if="open" class="save-pill-pop" role="dialog" :aria-label="t('Town & saves')">
      <div class="save-pill-head">
        <img src="/art/amethyst.svg" alt="" />
        <span
          ><strong>{{ account.townName.value }}</strong
          ><small>{{ t('Town & saves') }}</small></span
        >
        <button class="save-pill-close" :aria-label="t('Close town menu')" @click="close(true)">
          <GameIcon name="close" />
        </button>
      </div>
      <div class="save-pill-status" :data-tone="state.tone">
        <strong
          ><GameIcon :name="state.tone === 'local' ? 'phone' : 'cloud'" />{{ statusTitle }}</strong
        >
        <small v-if="account.accountTown.value">{{ subtitle }}</small>
        <p>{{ t(state.detail) }}</p>
        <button
          v-if="primary"
          class="save-pill-primary"
          :disabled="primary.disabled"
          @click="run(primary.run)"
        >
          {{ t(primary.label) }}
        </button>
        <small v-if="!account.signedIn.value">{{
          t('Just your email. No password needed.')
        }}</small>
      </div>
      <button
        class="save-pill-action"
        :disabled="!account.canOpen.value"
        @click="run(account.openCommunity)"
      >
        <GameIcon name="eye" />
        <span
          ><strong>{{ t('Visit towns') }}</strong
          ><small>{{ t('Explore other mayors’ towns') }}</small></span
        >
        <GameIcon name="chevron" />
      </button>
      <button
        class="save-pill-action"
        :disabled="!account.canOpen.value"
        @click="run(account.openSharing)"
      >
        <GameIcon name="share" />
        <span
          ><strong>{{ t('Share my town') }}</strong
          ><small>{{
            t(
              account.shared.value
                ? 'Shared · Welcome visitors'
                : 'Private · Invite friends when you’re ready',
            )
          }}</small></span
        >
        <GameIcon name="chevron" />
      </button>
      <button
        v-if="account.signedIn.value && state.action !== 'my-towns'"
        class="save-pill-action"
        :disabled="!account.canOpen.value"
        @click="run(account.open)"
      >
        <GameIcon name="user" /><span
          ><strong>{{ t('My towns & account') }}</strong></span
        >
        <GameIcon name="chevron" />
      </button>
    </div>
  </div>
</template>
<script setup>
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { timeAgo } from '../services/saveStatus';
import { useSettingsStore } from '../stores/settingsStore';
import GameIcon from './GameIcon.vue';
import { t } from '../i18n';
// Provided by CloudRoot; the parent renders this pill only when it exists.
const account = inject('cloudAccount');
const props = defineProps({
  active: { type: Boolean, default: true },
  introduce: Boolean,
});
const settings = useSettingsStore();
const open = ref(false),
  root = ref(null),
  trigger = ref(null),
  now = ref(Date.now());
const state = computed(() => account.saveState.value);
const introVisible = computed(
  () =>
    props.active &&
    props.introduce &&
    !settings.townMenuIntroduced &&
    !open.value &&
    state.value.tone !== 'alert',
);
const statusTitle = computed(() =>
  t(
    state.value.tone === 'saved'
      ? 'Backed up online'
      : state.value.tone === 'local'
        ? 'Saved on this device'
        : state.value.label,
  ),
);
const subtitle = computed(() => {
  if (!account.accountTown.value) return t('Only on this device');
  const ago = timeAgo(account.cloudAt.value, now.value);
  return ago ? t('Backed up {time}', { time: ago }) : t('Not backed up yet');
});
const ACTIONS = {
  'sign-in': () => ({
    label: account.signedIn.value ? 'Sign in again' : 'Save online · Sign in',
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
async function toggle() {
  if (open.value) return close();
  if (!props.active) return;
  dismissIntro();
  now.value = Date.now();
  open.value = true;
  await nextTick();
  root.value?.querySelector('.save-pill-pop button:not(:disabled):not(.save-pill-close)')?.focus();
}
function dismissIntro() {
  settings.dismissTownMenuIntro();
}
function close(restoreFocus = false) {
  if (introVisible.value) dismissIntro();
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}
function run(action) {
  open.value = false;
  action();
}
function outside(event) {
  if (!root.value?.contains(event.target)) close();
}
function leave(event) {
  // Removing the introduction can report no next target. Only an actual focus
  // move outside closes the menu; moving between its buttons must keep it open.
  if (open.value && event.relatedTarget && !root.value?.contains(event.relatedTarget)) close();
}
watch(
  () => props.active,
  (active) => {
    if (!active) open.value = false;
  },
);
watch(
  () => open.value || introVisible.value,
  (visible) => {
    if (visible) document.addEventListener('pointerdown', outside, true);
    else document.removeEventListener('pointerdown', outside, true);
  },
  { immediate: true },
);
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
/* The open town is always named, so switching towns never needs My towns to check. */
.save-pill-town {
  max-width: 150px;
  overflow: hidden;
  font:
    700 14px Georgia,
    serif;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.save-pill-label {
  padding-left: 8px;
  border-left: 1px solid #cfc3a0;
  font-weight: 600;
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
  max-height: calc(100dvh - 150px);
  overflow-y: auto;
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
  padding-right: 24px;
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
  border-radius: 9px;
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
.save-pill .save-pill-chevron {
  width: 14px;
  height: 14px;
}
.save-pill-pop .save-pill-close {
  position: absolute;
  top: 10px;
  right: 8px;
  min-height: 28px;
  padding: 4px;
  border: 0;
  background: transparent;
}
.save-pill-close svg {
  width: 18px;
  height: 18px;
}
.save-pill-status {
  display: grid;
  gap: 7px;
  padding: 11px;
  border-radius: 10px;
  background: #eef0e2;
  font-size: 12px;
}
.save-pill-status[data-tone='alert'] {
  background: #fff1cf;
}
.save-pill-status > strong {
  display: flex;
  align-items: center;
  gap: 7px;
}
.save-pill-status svg {
  width: 17px;
  height: 17px;
}
.save-pill-status small,
.save-pill-action small {
  color: #64756a;
  font-size: 11px;
  font-weight: 400;
}
.save-pill-status p {
  line-height: 1.45;
}
.save-pill-status > button + small {
  text-align: center;
}
.save-pill-pop .save-pill-action {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 0;
  border: 0;
  border-top: 1px solid #e3dbc7;
  border-radius: 0;
  text-align: left;
}
.save-pill-action span {
  display: grid;
  gap: 4px;
}
.save-pill-action > svg {
  width: 19px;
  height: 19px;
}
.save-pill-action > svg:last-child {
  width: 14px;
  height: 14px;
  margin-left: auto;
  transform: rotate(-90deg);
}
.save-pill-kicker {
  padding-right: 20px;
  color: #96723e;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.save-pill-intro-title {
  font:
    700 20px/1.2 Georgia,
    serif;
}
.save-pill-intro p {
  font-size: 12px;
  line-height: 1.5;
}
.save-pill-intro-actions {
  display: flex;
  gap: 10px;
}
.save-pill-intro-actions > button:last-child {
  border: 0;
  background: transparent;
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
  .save-pill-town {
    max-width: 96px;
  }
}
</style>
