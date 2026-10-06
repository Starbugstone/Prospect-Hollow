<template>
  <div class="account-towns">
    <div class="account-slot-summary">
      <span class="account-slots">
        <span
          v-for="slot in SLOT_LIMIT"
          :key="slot"
          class="account-pip"
          :class="{ 'is-used': slot <= cloud.towns.length }"
          aria-hidden="true"
        ></span>
        {{ t('{count} of 3 slots used', { count: cloud.towns.length }) }}
      </span>
      <span v-if="saveState" class="account-save-state" :data-tone="saveState.tone">{{
        t(saveState.label)
      }}</span>
      <button
        class="account-icon"
        :class="{ 'is-busy': busy }"
        :disabled="busy"
        :aria-label="t('Refresh towns')"
        :title="t('Refresh towns')"
        @click="act(refreshAccount)"
      >
        <GameIcon name="sync" />
      </button>
    </div>
    <p v-if="game.sessionActive" class="account-message">
      {{ t('Leave the mine before switching towns or resolving saves.') }}
    </p>
    <aside v-if="registeredLocal" class="account-callout">
      <GameIcon name="phone" />
      <p>
        {{
          t(
            'This is a separate local copy. Open your account town to continue its saved progress; this local copy will be kept.',
          )
        }}
      </p>
      <button
        class="account-primary"
        :disabled="busy || game.sessionActive"
        @click="act(() => openTown(registeredLocal))"
      >
        {{ t('Open my account town') }}
      </button>
    </aside>
    <aside v-else-if="localTown" class="account-callout">
      <GameIcon name="phone" />
      <p>
        <strong>{{ t('“{town}” is only on this device.', { town: localTown.meta.name }) }}</strong>
        {{
          t(
            full
              ? 'Your account is full. This town stays playable here. Delete a cloud town to free a slot.'
              : 'Put it in an empty slot so it is backed up.',
          )
        }}
      </p>
    </aside>
    <aside v-else-if="missingTown" class="account-callout">
      <GameIcon name="cloud" />
      <p>
        {{
          t(
            'This cloud town was deleted or is unavailable. Its local copy has been kept; it will not be uploaded automatically.',
          )
        }}
      </p>
      <form v-if="!full" class="account-stack" @submit.prevent="act(copyMissingTown)">
        <label class="account-field"
          >{{ t('New town name') }}<input v-model="copyName" minlength="3" maxlength="24" required
        /></label>
        <button class="account-primary" :disabled="busy || game.sessionActive">
          {{ t('Save this progress as a new account town') }}
        </button>
      </form>
    </aside>
    <ul class="town-slots" @keydown.esc.stop="menu = null">
      <li
        v-for="town in cards"
        :key="town.townId"
        class="town-slot"
        :class="{ 'is-current': isCurrent(town) }"
      >
        <TownCardArt :era="town.card?.era" :crest="town.card?.crest" />
        <button
          class="town-slot-more"
          aria-haspopup="menu"
          :aria-expanded="menu === town.townId"
          :aria-label="t('More for {town}', { town: town.name })"
          @click="menu = menu === town.townId ? null : town.townId"
        >
          <GameIcon name="more" />
        </button>
        <div v-if="menu === town.townId" class="town-slot-menu" role="menu">
          <template v-if="isCurrent(town)">
            <button role="menuitem" @click="manage('sharing')">
              <GameIcon name="share" />{{ t('Share & rename') }}
            </button>
            <button role="menuitem" @click="manage('history')">
              <GameIcon name="history" />{{ t('Save history') }}
            </button>
          </template>
          <a role="menuitem" :href="townUrl(town.townId)" target="_blank" rel="noopener"
            ><GameIcon name="external" />{{ t('Open in a new tab') }}</a
          >
          <button
            v-if="isCurrent(town)"
            role="menuitem"
            class="is-danger"
            @click="manage('delete')"
          >
            <GameIcon name="trash" />{{ t('Delete from the cloud…') }}
          </button>
        </div>
        <div class="town-slot-info">
          <strong>{{ town.name }}</strong>
          <span class="town-slot-sharing" :class="{ 'is-shared': town.isPublic }"
            ><GameIcon v-if="town.isPublic" name="share" />{{
              t(town.isPublic ? 'Shared' : 'Private')
            }}</span
          >
          <small v-if="town.card?.era" class="town-card-era-mobile">{{
            eraName(town.card.era)
          }}</small>
          <small v-if="town.card">{{ stats(town.card) }}</small>
          <HonourCardRow :honours="town.card?.honours" :received="distinctions" :size="26" />
          <small>{{ savedAgo(town) }}</small>
          <span v-if="isCurrent(town)" class="town-slot-playing"
            ><GameIcon name="check" />{{ t('Playing now') }}</span
          >
          <button
            v-else
            class="account-primary"
            :disabled="busy || game.sessionActive"
            @click="act(() => openTown(town))"
          >
            {{ t('Open') }}
          </button>
        </div>
      </li>
      <li
        v-for="slot in emptySlots"
        :key="slot"
        class="town-slot is-empty"
        :class="{ 'is-local': slot === 'attach' }"
      >
        <form v-if="creating === slot" class="town-slot-form" @submit.prevent="act(submit)">
          <label class="account-field"
            >{{ t(slot === 'attach' ? 'Town name' : 'New town name')
            }}<input ref="nameInput" v-model="name" minlength="3" maxlength="24" required
          /></label>
          <button class="account-primary" :disabled="busy || game.sessionActive">
            {{ t(slot === 'attach' ? 'Back it up' : 'Create town') }}
          </button>
          <button type="button" class="account-link" @click="creating = null">
            {{ t('Cancel') }}
          </button>
        </form>
        <button v-else class="town-slot-add" :disabled="busy" @click="startCreating(slot)">
          <span class="town-slot-plus"
            ><GameIcon :name="slot === 'attach' ? 'cloud' : 'plus'"
          /></span>
          <strong>{{
            slot === 'attach' ? t('Back up “{town}”', { town: localTown.meta.name }) : t('New town')
          }}</strong>
          <small>{{
            slot === 'attach'
              ? stats(profileSummary(localTown.profile))
              : t('Start fresh in this empty slot')
          }}</small>
        </button>
      </li>
    </ul>
    <footer class="account-towns-footer">
      <button class="account-link" @click="community()">
        <GameIcon name="eye" />{{ t('Visit shared towns') }}<GameIcon name="arrow" />
      </button>
    </footer>
  </div>
</template>
<script setup>
import { computed, inject, nextTick, ref } from 'vue';
import {
  cloud,
  refreshAccount,
  syncNow,
  createAccountTown,
  attachLocal,
  cacheTown,
} from '../../services/cloudProfile';
import { townStorage } from '../../services/townStorage';
import { cardSummary, profileSummary } from '../../services/townSummary';
import { receivedDistinctions } from '../../data/playerDistinctions';
import { timeAgo } from '../../services/saveStatus';
import { freshProfile } from '../../stores/campaignStore';
import { useGameStore } from '../../stores/gameStore';
import { useAccountContext, eraName } from './accountContext';
import GameIcon from '../GameIcon.vue';
import TownCardArt from '../TownCardArt.vue';
import HonourCardRow from '../honours/HonourCardRow.vue';
import { townUrl } from '../../services/appRoute';
import { t, number } from '../../i18n';
const SLOT_LIMIT = 3;
const props = defineProps({ writable: Boolean });
const emit = defineEmits(['manage']);
const { busy, act, changed, close, community } = useAccountContext();
const account = inject('cloudAccount', null);
const game = useGameStore(),
  menu = ref(null),
  creating = ref(null),
  name = ref(''),
  copyName = ref(''),
  nameInput = ref(null);
const active = computed(() => {
  void cloud.storageVersion;
  return townStorage.active();
});
const localTown = computed(() =>
  props.writable && active.value && !active.value.meta.owner ? active.value : null,
);
const registeredLocal = computed(() =>
  localTown.value ? cloud.towns.find((town) => town.townId === localTown.value.meta.id) : null,
);
const missingTown = computed(
  () =>
    props.writable && active.value?.meta.owner === cloud.account.id && active.value.meta.missing,
);
const full = computed(() => cloud.towns.length >= SLOT_LIMIT);
// The player's own distinctions, for the one each town card may show.
const distinctions = computed(() => receivedDistinctions(cloud.account));
const emptySlots = computed(() => {
  const free = Math.max(0, SLOT_LIMIT - cloud.towns.length);
  const attach = localTown.value && !registeredLocal.value && free > 0 ? ['attach'] : [];
  return [...attach, ...Array.from({ length: free - attach.length }, (_, i) => i)];
});
const saveState = computed(() => (account?.accountTown.value ? account.saveState.value : null));
const isCurrent = (town) =>
  props.writable &&
  active.value?.meta.owner === cloud.account.id &&
  active.value?.meta.id === town.townId;
const cards = computed(() => {
  void cloud.storageVersion;
  return cloud.towns.map((town) => ({
    ...town,
    card: cardSummary(town, {
      activeProfile: isCurrent(town) ? active.value.profile : null,
      cachedProfile: !town.summary ? townStorage.get(town.townId, cloud.account.id)?.profile : null,
    }),
  }));
});
const stats = (summary) =>
  summary
    ? `${t('{count} buildings', { count: summary.buildings })} · ${t('{coins} coins', { coins: number(summary.coins) })}`
    : '';
const savedAgo = (town) => {
  const ago = timeAgo(town.updatedAt * 1000);
  return ago ? t('Saved {time}', { time: ago }) : t('Not synced yet');
};
function manage(section) {
  menu.value = null;
  emit('manage', section);
}
async function startCreating(slot) {
  creating.value = slot;
  name.value = slot === 'attach' ? localTown.value.meta.name : '';
  await nextTick();
  nameInput.value?.[0]?.focus();
}
async function submit() {
  if (creating.value === 'attach') await attachLocal(name.value);
  else await createTown();
  creating.value = null;
  name.value = '';
}
async function openTown(town) {
  if (game.sessionActive) return;
  await cacheTown(town);
  if (props.writable) await syncNow({ pull: false });
  townStorage.select(town.townId, cloud.account.id);
  changed();
  close();
}
async function createTown() {
  const town = await createAccountTown(name.value, freshProfile());
  await openTown(town);
}
async function copyMissingTown() {
  const town = await createAccountTown(copyName.value, active.value.profile);
  await openTown(town);
  copyName.value = '';
}
</script>
