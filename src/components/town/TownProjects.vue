<template>
  <section class="town-projects" :aria-label="t('Town projects')">
    <p v-if="town.era === 'frontier'">
      {{
        t(
          'Your first home is ready. Follow a town project to see familiar buildings grow together, at your own pace.',
        )
      }}
    </p>
    <p>{{ t('Choose a town project. Every improvement you already finished counts.') }}</p>
    <div class="project-choices">
      <button
        v-for="project in projects"
        :key="project.id"
        :aria-pressed="selected?.id === project.id"
        @click="campaign.focusTownProject(project.id)"
      >
        <span>{{ t(project.title) }}</span>
        <small>{{
          project.complete ? t('Project complete') : `${project.done}/${project.total}`
        }}</small>
        <progress :value="project.done" :max="project.total" :aria-label="t(project.title)" />
      </button>
    </div>
    <article v-if="selected" :aria-label="t(selected.title)">
      <h2>{{ t(selected.title) }}</h2>
      <ol class="project-milestones">
        <li
          v-for="milestone in selected.milestones"
          :key="milestone.level"
          :class="{ finished: milestone.done === milestone.total }"
        >
          <TownIcon :name="milestone.done === milestone.total ? 'check' : 'home'" />
          <span
            >{{ t(milestone.title)
            }}<small>{{
              t('All project buildings at project stage {level}: {count}/{total}', {
                level: milestone.level,
                count: milestone.done,
                total: milestone.total,
              })
            }}</small></span
          >
        </li>
      </ol>
      <p v-if="selected.complete" role="status" class="project-complete">
        {{ t('A new chapter in the town’s story. Your finished buildings are the reward.') }}
      </p>
      <div class="project-buildings">
        <button
          v-for="building in selected.buildings"
          :key="building.id"
          @click="$emit('inspect', building.id)"
        >
          <span
            >{{ t(building.name)
            }}<small>{{
              t('Project stage {level}/{total}', { level: building.level, total: building.target })
            }}</small></span
          >
          <span class="project-building-state">
            <template v-if="building.ready">{{ t('Ready to finish') }}</template>
            <template v-else-if="building.construction">{{
              t('Construction: {count}/{total} puzzles', {
                count: building.construction.wins,
                total: building.runs,
              })
            }}</template>
            <template v-else-if="building.level === building.target"
              ><TownIcon name="check" />{{ t('Complete') }}</template
            >
            <template v-else-if="building.offer"
              ><TownIcon name="coin" />{{ number(building.offer.cost)
              }}<small>{{
                t(building.offer.available ? 'View improvement' : 'View requirements')
              }}</small></template
            >
          </span>
        </button>
      </div>
    </article>
    <p class="project-note">
      {{
        t(
          'Build in any order. Other plots remain available, and the usual era requirements still apply.',
        )
      }}
    </p>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { t, number } from '../../i18n';
import { useCampaignStore } from '../../stores/campaignStore';
import { townProjects } from '../../game/town/TownProjects';
import TownIcon from './TownIcon.vue';
const props = defineProps({ town: { type: Object, required: true } });
defineEmits(['inspect']);
const campaign = useCampaignStore();
const projects = computed(() => townProjects(props.town));
const selected = computed(
  () =>
    projects.value.find((project) => project.id === campaign.townProjectFocus) ??
    projects.value.find((project) => !project.complete) ??
    projects.value[0],
);
</script>
<style scoped>
.town-projects {
  color: #405448;
}
.town-projects > p {
  margin: 0 0 12px;
  line-height: 1.4;
}
.project-choices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
}
.project-choices button {
  padding: 12px;
  border: 1px solid #bac4ae;
  border-radius: 10px;
  background: #eeeedd;
  color: inherit;
  text-align: left;
}
.project-choices button[aria-pressed='true'] {
  background: #dce7d2;
  border: 2px solid #456c50;
  padding: 11px;
}
.project-choices span {
  display: block;
  font-weight: 700;
}
.project-choices small {
  display: block;
  margin: 7px 0;
}
progress {
  width: 100%;
  height: 7px;
  accent-color: #456c50;
}
h2 {
  font-size: 22px;
  margin: 22px 0 12px;
}
.project-milestones {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 10px;
}
.project-milestones li {
  display: flex;
  align-items: center;
  gap: 10px;
}
small {
  display: block;
  font-size: 12px;
  margin-top: 4px;
}
svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.finished,
.project-complete {
  color: #315c39;
}
.project-complete {
  padding: 12px;
  background: #e1ead4;
  border-radius: 8px;
}
.project-buildings {
  display: grid;
  gap: 7px;
}
.project-buildings button {
  min-height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fffbed;
  border: 1px solid #c3c5b1;
  border-radius: 8px;
  text-align: left;
  color: inherit;
}
.project-building-state {
  text-align: right;
  font-size: 13px;
}
.project-building-state svg {
  width: 16px;
  height: 16px;
  vertical-align: middle;
  margin-right: 4px;
}
.project-note {
  font-size: 12px;
  line-height: 1.5;
}
button:focus-visible {
  outline: 3px solid #977128;
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .project-choices {
    grid-template-columns: 1fr;
  }
  .project-choices button {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px;
    min-height: 60px;
  }
  .project-choices progress {
    grid-column: 1 / -1;
  }
  .project-choices small {
    margin: 0;
  }
}
</style>
