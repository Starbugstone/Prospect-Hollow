<template>
  <section aria-labelledby="admin-honours-title">
    <h2 id="admin-honours-title">Achievements · Town Honours</h2>
    <p class="admin-muted">
      Progress and earned ranks from the latest cloud save, with current visitor counts. Unsynced
      progress on the player’s device is not included.
    </p>
    <h3>Player’s showcase</h3>
    <p class="admin-muted">The player’s three display slots, in their chosen order.</p>
    <ol class="admin-honour-showcase" aria-label="Displayed achievements">
      <li v-for="(slot, index) in slots" :key="index">
        <span class="admin-muted">Slot {{ index + 1 }}</span>
        <strong>{{ slot?.name ?? 'Empty slot' }}</strong>
        <span v-if="slot">{{ slot.track.text }}</span>
      </li>
    </ol>
    <p v-if="!profile.honours" class="admin-notice">
      This save predates Town Honours. No earned ranks or showcase choices have been saved yet.
    </p>
    <section v-for="group in groups" :key="group.id" :aria-labelledby="`honours-${group.id}`">
      <h3 :id="`honours-${group.id}`">
        {{ TAB_LABELS[group.id] }} · {{ group.earned }} of {{ group.total }} families earned
      </h3>
      <table class="admin-table admin-honours-table">
        <thead>
          <tr>
            <th scope="col">Achievement</th>
            <th scope="col">Earned ranks</th>
            <th scope="col">Progress to next rank</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="family in group.families" :key="family.id">
            <td>
              <details>
                <summary>{{ family.name }}</summary>
                <ul class="admin-honour-ranks">
                  <li v-for="rank in family.ranks" :key="rank.id">
                    <strong>{{ rank.metal }} · {{ rank.name }}</strong>
                    <span>{{ rank.requirement }}</span>
                    <span :class="rank.earned ? 'admin-honour-earned' : 'admin-muted'">
                      {{ rank.earned?.text ?? 'Not earned' }}
                    </span>
                  </li>
                </ul>
              </details>
            </td>
            <td>{{ family.track.text }}</td>
            <td>
              <template v-if="family.progress">
                <span>{{ family.nextRank || family.requirement }}</span>
                <progress
                  :value="family.progress.percent"
                  max="100"
                  :aria-label="`${family.name}: ${family.progress.text}`"
                />
                <span class="admin-muted">{{ family.progress.text }}</span>
              </template>
              <span v-else>All current ranks earned</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { honourCollection, normalizeHonours, recordSocial } from '../../data/honours';
import { describeFamily, showcaseSlots, TAB_LABELS } from '../../components/honours/honourDisplay';

const props = defineProps({
  profile: { type: Object, required: true },
  uniqueVisitors: { type: Number, default: 0 },
  townsVisited: { type: Number, default: 0 },
});
// Presentation only: these pure helpers do not award ranks, mark notices seen or save.
const state = computed(() => ({
  ...props.profile,
  town: {
    ...props.profile.town,
    buildings: props.profile.town?.buildings ?? {},
    projects: props.profile.town?.projects ?? {},
    buildingEras: props.profile.town?.buildingEras ?? {},
  },
  honours:
    recordSocial(props.profile.honours, {
      visitors: props.uniqueVisitors,
      travels: props.townsVisited,
    }) ?? normalizeHonours(props.profile.honours),
}));
const slots = computed(() =>
  showcaseSlots(state.value.honours.showcase, state.value.honours.earned),
);
const groups = computed(() =>
  honourCollection(state.value).map((group) => ({
    ...group,
    families: group.families.map((family) => describeFamily(family, state.value)),
  })),
);
</script>
