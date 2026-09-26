<template>
  <section class="game-view-status" :role="failed ? 'alert' : 'status'" :aria-busy="!failed">
    <img src="/art/amethyst.svg" alt="" />
    <h2>{{ t(failed ? 'This view could not load' : label) }}</h2>
    <p>
      {{
        t(
          failed
            ? 'Your saved progress has been kept. Reload the page to try again.'
            : 'Your town is saved on this device.',
        )
      }}
    </p>
    <button v-if="failed" @click="reload">{{ t('Reload the game') }}</button>
  </section>
</template>
<script setup>
import { t } from '../i18n';
defineProps({ label: { type: String, default: 'Loading your town…' }, failed: Boolean });
const reload = () => location.reload();
</script>
<style>
.game-view-status {
  min-height: 18rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
  padding: 2rem;
  color: #294139;
  background: #f6f1e6;
}
.game-view-status img {
  width: 2.7rem;
  height: 2.7rem;
}
.game-view-status h2 {
  font:
    1.6rem Georgia,
    serif;
  margin: 0.4rem 0;
}
.game-view-status p {
  max-width: 28rem;
  font: 0.95rem/1.6 system-ui;
  margin: 0;
}
.game-view-status button {
  font: inherit;
  padding: 0.7rem 1rem;
  margin-top: 0.8rem;
  background: #315940;
  color: #fffdf6;
  border: 0;
  border-radius: 0.6rem;
  cursor: pointer;
}
</style>
