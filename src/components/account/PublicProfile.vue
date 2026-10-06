<template>
  <section class="account-section public-profile" aria-labelledby="public-profile-title">
    <h2 id="public-profile-title">{{ t('Public profile') }}</h2>
    <p>{{ t('Choose the name other mayors see when you visit their towns.') }}</p>
    <p v-if="loading" role="status">{{ t('Loading…') }}</p>
    <form v-else-if="profile" @submit.prevent="save">
      <label class="account-field">
        {{ t('Public name') }}
        <input
          v-model="name"
          maxlength="24"
          autocomplete="nickname"
          :placeholder="t('Your mayor name')"
        />
      </label>
      <small>{{ t('Optional. Use a nickname, not an email address.') }}</small>
      <label v-if="towns.length" class="account-field">
        {{ t('Visiting as') }}
        <select v-model="townId">
          <option :value="null">{{ t('Use my current town') }}</option>
          <option v-for="town in towns" :key="town.townId" :value="town.townId">
            {{ town.name }}
          </option>
        </select>
      </label>
      <label class="account-toggle">
        <span>
          <strong>{{ t('Private visits') }}</strong>
          <small>{{
            t(
              'Sign guestbooks without your name or town. Your visits still count for the towns you visit.',
            )
          }}</small>
        </span>
        <input v-model="anonymous" type="checkbox" role="switch" />
      </label>
      <p class="public-profile-preview" :aria-label="t('Visitor name preview')">
        <strong>{{ visitorName(preview) }}</strong>
        <span v-if="visitorTitle(preview)">{{ visitorTitle(preview) }}</span>
      </p>
      <button class="account-primary" :disabled="saving">
        {{ t(saving ? 'Saving…' : 'Save public profile') }}
      </button>
    </form>
    <p v-if="message" role="status">{{ t(message) }}</p>
    <button v-if="!loading && !profile" @click="load">{{ t('Try again') }}</button>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { loadVisitorProfile, saveVisitorProfile } from '../../services/visitorApi';
import { townStorage } from '../../services/townStorage';
import { visitorName, visitorTitle } from '../../data/liveVisitors';
import { t } from '../../i18n';

const profile = ref(null),
  towns = ref([]),
  name = ref(''),
  townId = ref(null),
  anonymous = ref(false);
const loading = ref(true),
  saving = ref(false),
  message = ref('');
let disposed = false;
// A private visit shows as a plain visitor, exactly as other mayors will see it.
const preview = computed(() =>
  anonymous.value ? {} : { name: name.value.trim(), townName: previewTown.value },
);
const previewTown = computed(
  () =>
    (
      towns.value.find((town) => town.townId === (townId.value || townStorage.active()?.meta.id)) ??
      towns.value[0]
    )?.name,
);
async function load() {
  loading.value = true;
  message.value = '';
  try {
    const result = await loadVisitorProfile();
    if (disposed) return;
    profile.value = result.profile;
    towns.value = result.towns;
    name.value = result.profile?.displayName ?? '';
    townId.value = result.profile?.visitingTownId ?? null;
    anonymous.value = result.profile?.anonymousVisits ?? false;
  } catch (error) {
    if (!disposed) message.value = error.message;
  } finally {
    if (!disposed) loading.value = false;
  }
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  message.value = '';
  try {
    const result = await saveVisitorProfile({
      displayName: name.value.trim(),
      visitingTownId: townId.value,
      anonymousVisits: anonymous.value,
    });
    if (disposed) return;
    profile.value = result.profile;
    name.value = result.profile.displayName;
    message.value = 'Public profile saved.';
  } catch (error) {
    if (!disposed) message.value = error.message;
  } finally {
    if (!disposed) saving.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => {
  disposed = true;
});
</script>
<style scoped>
.public-profile p {
  line-height: 1.5;
}
.public-profile form {
  display: grid;
  gap: 0.8rem;
}
.public-profile select {
  width: 100%;
  min-width: 0;
  padding: 0.7rem;
  border: 1px solid #b7b7a1;
  border-radius: 8px;
  font: inherit;
  background: #fffdf6;
  color: #294139;
}
.public-profile-preview {
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem;
  border-left: 4px solid #82518b;
  background: #f2eaf4;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
.public-profile-preview span {
  font-size: 0.9rem;
}
</style>
