<template>
  <div class="honour-progress">
    <ul v-if="model.chips" class="honour-chips" :aria-label="t('Bonus fusions')">
      <li v-for="chip in model.chips" :key="chip.key" :class="{ 'is-done': chip.done }">
        <span v-if="chip.done" aria-hidden="true">✓</span>{{ chip.text
        }}<span class="town-sr-only"> · {{ t(chip.done ? 'Done' : 'Not yet') }}</span>
      </li>
    </ul>
    <ul v-if="model.checks" class="honour-checks" :aria-label="t('Powers')">
      <li v-for="check in model.checks" :key="check.id" :class="{ 'is-done': check.done }">
        <span aria-hidden="true">{{ check.done ? '✓' : '○' }}</span
        >{{ check.text
        }}<span class="town-sr-only"> · {{ t(check.done ? 'Done' : 'Not yet') }}</span>
      </li>
    </ul>
    <template v-if="model.progress">
      <div
        class="honour-bar"
        role="progressbar"
        :aria-label="t('Progress: {name}', { name: model.name })"
        aria-valuemin="0"
        :aria-valuemax="model.progress.goal"
        :aria-valuenow="model.progress.value"
        :aria-valuetext="model.progress.text"
      >
        <i :style="{ width: `${model.progress.percent}%` }"></i>
      </div>
      <span class="honour-progress-text">{{ model.progress.text }}</span>
    </template>
  </div>
</template>
<script setup>
import { t } from '../../i18n';
// Progress toward a family's next rank, shared by cards and the detail view: the bar,
// and the keys or powers a rank needs all of (Fusion Master, Master Quartermaster).
defineProps({ model: { type: Object, required: true } });
</script>
<style>
.honour-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.honour-bar {
  height: 8px;
  border-radius: 99px;
  background: #d9d7c8;
  overflow: hidden;
}
.honour-bar i {
  display: block;
  height: 100%;
  min-width: 2px;
  border-radius: inherit;
  background: linear-gradient(90deg, #5d805f, #7fa279);
}
/* Toward a further rank of a family already earned: a gold bar. */
.honour-progress-next .honour-bar i {
  background: linear-gradient(90deg, #b48b35, #d9b468);
}
.honour-progress-text {
  font-size: 12px;
  color: #4f5747;
  font-variant-numeric: tabular-nums;
}
.honour-chips,
.honour-checks {
  list-style: none;
  margin: 0;
  padding: 0;
}
.honour-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.honour-chips li {
  display: inline-flex;
  gap: 4px;
  padding: 3px 9px;
  border: 1px dashed #a9a793;
  border-radius: 99px;
  font-size: 11px;
  color: #535a4a;
}
.honour-chips li.is-done {
  border: 1px solid #86a38a;
  background: #e1eadc;
  color: #2f4a37;
}
.honour-checks {
  display: grid;
  gap: 3px;
  font-size: 12px;
  color: #4f5747;
}
.honour-checks li {
  display: flex;
  gap: 6px;
}
.honour-checks li.is-done {
  color: #2f4a37;
}
.honour-contrast .honour-bar {
  background: #c4c2b0;
  outline: 1px solid #4f5840;
}
.honour-contrast .honour-chips li {
  border-color: #4f5840;
}
@media (forced-colors: active) {
  .honour-bar {
    border: 1px solid CanvasText;
  }
  .honour-bar i {
    background: Highlight;
  }
}
</style>
