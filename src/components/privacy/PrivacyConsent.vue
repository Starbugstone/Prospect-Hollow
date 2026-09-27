<template>
  <Teleport to="body">
    <PrivacyChoicesDialog v-if="state.preferencesOpen" :state="state" />
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { locale } from '../../i18n';
import { privacyService } from '../../services/privacy/privacyService';
import PrivacyChoicesDialog from './PrivacyChoicesDialog.vue';

const state = shallowRef(privacyService.getState());
const unsubscribe = privacyService.subscribe((value) => (state.value = value));
onMounted(() => privacyService.initialize({ locale: locale.value }));
onBeforeUnmount(unsubscribe);
</script>
