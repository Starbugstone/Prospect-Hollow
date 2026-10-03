<template>
  <HonourCollection
    v-if="!village && requests.collection"
    :family-id="requests.collection.familyId"
    @close="closeCollection"
  />
</template>
<script setup>
import { defineAsyncComponent } from 'vue';
import { useHonourNavigation } from '../../composables/useHonourNavigation';
// Opens the collection wherever the village cannot: from town management, the home
// page or a popup over a finished puzzle. Inside the village, TownView opens it with
// museum and building links instead.
defineProps({ village: Boolean });
const HonourCollection = defineAsyncComponent(() => import('./HonourCollection.vue'));
const { requests, closeCollection } = useHonourNavigation();
</script>
