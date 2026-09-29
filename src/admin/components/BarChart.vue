<template>
  <figure ref="figure" class="chart">
    <figcaption>
      <strong>{{ title }}</strong>
      <span v-if="subtitle">{{ subtitle }}</span>
    </figcaption>
    <div v-if="horizontal" class="chart-rows">
      <div
        v-for="item in items"
        :key="item.key"
        class="chart-row"
        :class="{ active: hover?.item === item }"
        tabindex="0"
        :aria-label="describe(item)"
        @pointerenter="show(item, $event)"
        @pointerleave="hide"
        @focus="show(item, $event)"
        @blur="hide"
      >
        <span class="chart-row-label">{{ item.label }}</span>
        <span class="chart-row-track">
          <span class="chart-bar" :style="{ width: share(item.value) }" />
        </span>
        <span class="chart-row-value">{{ whole(item.value) }}</span>
      </div>
    </div>
    <div v-else class="chart-plot">
      <div class="chart-ticks" aria-hidden="true">
        <span v-for="tick in ticks" :key="tick" :style="{ bottom: share(tick) }">{{
          whole(tick)
        }}</span>
      </div>
      <div class="chart-columns">
        <div
          v-for="item in items"
          :key="item.key"
          class="chart-column"
          :class="{ active: hover?.item === item }"
          tabindex="0"
          :aria-label="describe(item)"
          @pointerenter="show(item, $event)"
          @pointerleave="hide"
          @focus="show(item, $event)"
          @blur="hide"
        >
          <span class="chart-bar" :style="{ height: share(item.value) }" />
        </div>
      </div>
      <div class="chart-axis" aria-hidden="true">
        <span v-for="(item, index) in items" :key="item.key">{{ tickLabel(index) }}</span>
      </div>
    </div>
    <p
      v-if="hover"
      class="chart-tip"
      role="status"
      :style="{ left: `${hover.x}px`, top: `${hover.y}px` }"
    >
      <span>{{ hover.item.label }}</span>
      <strong>{{ amount(hover.item.value) }}</strong>
    </p>
    <details class="chart-table">
      <summary>Table</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">{{ categoryName }}</th>
            <th scope="col" class="number">{{ unit }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.key">
            <td>{{ item.label }}</td>
            <td class="number">{{ whole(item.value) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>
<script setup>
import { computed, ref } from 'vue';
import { niceMax, whole } from '../format';
// One series per chart, one hue: bars grow from a single baseline on a rounded scale.
const props = defineProps({
  title: String,
  subtitle: String,
  items: { type: Array, required: true },
  unit: { type: String, default: '' },
  unitOne: String,
  categoryName: { type: String, default: 'Category' },
  horizontal: Boolean,
  // Column charts label every Nth category, counted back from the last one.
  labelEvery: { type: Number, default: 1 },
});
const figure = ref(null),
  hover = ref(null);
const max = computed(() => niceMax(Math.max(0, ...props.items.map((item) => item.value))));
// Counts only: a middle gridline appears when it is a whole number.
const ticks = computed(() =>
  Number.isInteger(max.value / 2) ? [0, max.value / 2, max.value] : [0, max.value],
);
const share = (value) => `${(Math.max(0, value) / max.value) * 100}%`;
const amount = (value) =>
  `${whole(value)} ${value === 1 ? (props.unitOne ?? props.unit) : props.unit}`;
const describe = (item) => `${item.label}: ${amount(item.value)}`;
// Counted back from the newest category, so today is always labelled and none collide.
const tickLabel = (index) =>
  (props.items.length - 1 - index) % props.labelEvery === 0 ? props.items[index].label : '';
function show(item, event) {
  // Anchor above the bar's data end so the tooltip never covers the mark it describes.
  const bar = event.currentTarget.querySelector('.chart-bar').getBoundingClientRect();
  const frame = figure.value.getBoundingClientRect();
  hover.value = {
    item,
    x: (props.horizontal ? bar.right : bar.left + bar.width / 2) - frame.left,
    y: (props.horizontal ? event.currentTarget.getBoundingClientRect().top : bar.top) - frame.top,
  };
}
const hide = () => {
  hover.value = null;
};
</script>
