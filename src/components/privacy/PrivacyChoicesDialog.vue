<template>
  <dialog
    ref="dialog"
    class="privacy-dialog"
    aria-labelledby="privacy-title"
    aria-describedby="privacy-summary"
    @cancel.prevent="close"
    @click="dismissBackdrop"
  >
    <header>
      <h2 id="privacy-title">{{ copy.title }}</h2>
      <button
        ref="closeButton"
        type="button"
        class="privacy-close"
        :aria-label="copy.close"
        @click="close"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <template v-if="state.source === 'placeholder'">
      <p id="privacy-summary">{{ copy.introduction }}</p>
      <p>{{ copy.optional }}</p>
      <p class="privacy-notice">{{ state.mockEnabled ? copy.mock : copy.placeholder }}</p>
      <div class="privacy-actions">
        <button type="button" @click="choose(false)">{{ copy.reject }}</button>
        <button type="button" :aria-expanded="managing" @click="managing = !managing">
          {{ copy.manage }}
        </button>
        <button type="button" @click="choose(true)">{{ copy.accept }}</button>
      </div>
      <section v-if="managing" class="privacy-categories" :aria-label="copy.manage">
        <div>
          <h3>
            {{ copy.necessary }} <small>{{ copy.always }}</small>
          </h3>
          <p>{{ copy.necessaryDetail }}</p>
        </div>
        <label class="privacy-toggle">
          <span>{{ copy.advertising }}</span>
          <input v-model="advertising" type="checkbox" />
        </label>
        <p>{{ copy.advertisingDetail }}</p>
        <button type="button" class="privacy-save" @click="choose(advertising)">
          {{ copy.save }}
        </button>
      </section>
    </template>
    <template v-else>
      <p id="privacy-summary" role="status">{{ copy.unavailable }}</p>
      <button type="button" class="privacy-save" @click="close">{{ copy.continue }}</button>
    </template>
    <details class="privacy-policy" :open="managing">
      <summary>{{ copy.policy }}</summary>
      <p>{{ copy.localData }}</p>
      <p v-if="state.source === 'placeholder'">{{ copy.previewData }}</p>
      <p>{{ copy.accountData }}</p>
      <p>{{ copy.plannedPartners }}</p>
      <p v-if="state.source === 'placeholder'">{{ copy.policyLimit }}</p>
      <nav :aria-label="copy.providers">
        <a href="https://io.gamemonetize.com/privacy.html" target="_blank" rel="noopener noreferrer"
          >GameMonetize</a
        >
        <a
          href="https://policies.google.com/technologies/ads"
          target="_blank"
          rel="noopener noreferrer"
          >Google</a
        >
        <a
          href="https://www.cookiebot.com/en/privacy-policy/"
          target="_blank"
          rel="noopener noreferrer"
          >Cookiebot</a
        >
      </nav>
    </details>
  </dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { privacyService } from '../../services/privacy/privacyService';
import { privacyCopy } from './privacyCopy';

const props = defineProps({ state: { type: Object, required: true } });
const copy = computed(privacyCopy);
const managing = ref(false);
const advertising = ref(props.state.choice === 'accepted');
const close = () => privacyService.closePreferences();
const choose = (allowed) => privacyService.setMockChoice(allowed);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(close);
</script>

<style scoped>
.privacy-dialog {
  width: min(640px, calc(100vw - 24px));
  max-height: calc(100dvh - 32px);
  box-sizing: border-box;
  margin: auto;
  padding: 24px;
  overflow-y: auto;
  border: 1px solid #8d729d;
  border-radius: 18px;
  background: #21192c;
  color: #fff5e1;
  box-shadow: 0 18px 70px #0008;
  font-size: 0.92rem;
  line-height: 1.55;
}
.privacy-dialog::backdrop {
  background: #090612ad;
}
header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}
h2 {
  margin: 0;
  font-size: 1.35rem;
}
h3 {
  margin: 0;
  font-size: 1rem;
}
p {
  margin: 12px 0;
}
button {
  cursor: pointer;
  font: inherit;
}
.privacy-close {
  flex: none;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 1.6rem;
  line-height: 1;
  min-width: 40px;
  min-height: 40px;
}
.privacy-notice {
  padding: 12px 14px;
  border-radius: 10px;
  background: #382b45;
}
.privacy-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 20px;
}
.privacy-actions button,
.privacy-save {
  border: 1px solid #c5a7dc;
  border-radius: 10px;
  background: #493557;
  color: #fff5e1;
  padding: 10px 12px;
  min-height: 46px;
  font-weight: 600;
}
button:hover {
  background-color: #674879;
}
button:focus-visible,
a:focus-visible,
summary:focus-visible,
input:focus-visible {
  outline: 3px solid #efbe68;
  outline-offset: 3px;
}
.privacy-categories {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #765d85;
}
.privacy-categories p {
  color: #e0d0e8;
}
small {
  display: inline-block;
  margin-left: 8px;
  color: #cdb5dc;
  font-size: 0.8rem;
}
.privacy-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  font-weight: 600;
}
.privacy-toggle input {
  width: 22px;
  height: 22px;
  accent-color: #c29ae8;
}
.privacy-policy {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid #765d85;
}
summary {
  cursor: pointer;
  color: #ead3e4;
}
.privacy-policy p {
  color: #e0d0e8;
  font-size: 0.85rem;
}
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
a {
  color: #efcfff;
}
@media (max-width: 520px) {
  .privacy-dialog {
    padding: 18px;
  }
  .privacy-actions {
    grid-template-columns: 1fr;
  }
}
</style>
