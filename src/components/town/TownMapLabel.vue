<template>
  <button
    type="button"
    class="town-map-label"
    :class="{
      'quiet-plot': quiet,
      'can-build': available || status?.kind === 'available',
      'is-ready': status?.kind === 'ready',
      'has-income': status?.kind === 'coins' || status?.kind === 'tnt',
    }"
  >
    <span v-if="quiet" class="quiet-plot-plus" aria-hidden="true">+</span>
    <span class="plot-name">{{ name }}</span>
    <TownLabelStatus :status="status" />
  </button>
</template>
<script setup>
import TownLabelStatus from './TownLabelStatus.vue';

// One pill, including typography, states and responsive sizing, on every map.
// TownLabelLayout owns screen clearance; each map supplies its projected anchors.
defineProps({
  name: { type: String, required: true },
  status: { type: Object, default: null },
  quiet: Boolean,
  available: Boolean,
});
</script>
<style>
.town-map-label {
  position: absolute;
  min-width: 0;
  max-width: calc(100% - 16px);
  /* Placed with the per-frame `translate` property (see TownLabels.js). */
  left: 0;
  top: 0;
  transform: translate(-50%, calc(-30% + var(--label-offset, 0px)));
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 36px;
  padding: 7px 12px;
  border-radius: 16px;
  border: 1px solid #bba77c;
  background: #ffffff;
  color: #4e5b45;
  font:
    13px Georgia,
    serif;
  box-shadow: 0 3px 7px #534a3022;
  white-space: nowrap;
}
.town-map-label:active:not(:disabled) {
  transform: translate(-50%, calc(-30% + var(--label-offset, 0px))) scale(0.97);
}
.town-map-label.has-action-icon {
  --label-offset: 24px;
}
.town-map-label.selected {
  outline: 2px solid #789788;
  outline-offset: 2px;
}
.town-map-label:focus-visible {
  outline: 3px solid #426654;
  outline-offset: 3px;
}
.town-map-label small {
  font: 9px var(--font-body, 'Trebuchet MS', 'Segoe UI', sans-serif);
}
.high-contrast .town-view .scene-mine-button small {
  color: inherit;
}
/* A shortage names the building that would fix it. */
.town-map-label small.need-hint {
  color: #8a4f0f;
  font-weight: 700;
}
.town-map-label:hover {
  box-shadow: 0 4px 14px #534a3044;
}
/* Keep the mine entrance visible below its label at every camera distance. */
.town-map-label.scene-mine-button {
  --label-offset: -56px;
}
/* Enlarge the tap target without changing the visible mine label. */
.town-map-label.scene-mine-button::before {
  content: '';
  position: absolute;
  inset: -14px;
  border-radius: inherit;
}
@media (max-width: 550px) {
  .town-map-label {
    min-height: 32px;
    padding: 7px;
    gap: 3px;
    font-size: 10px;
    border-radius: 11px;
  }
  .town-map-label small {
    font-size: 8px;
  }
  .town-map-label small.need-hint {
    font-size: 10px;
  }
  .town-map-label.scene-mine-button {
    flex-direction: column;
    min-height: 44px;
  }
}
/* The same state looks the same on every map's labels, the valley's and the Moon's. */
.town-map-label.can-build {
  background: #d9f1fa;
  border-color: #83b7c6;
  color: #345663;
}
.town-map-label.is-ready,
.town-map-label.has-income,
.town-map-label.scene-mine-button {
  background: #e1f0c0;
  border-color: #8baa65;
  color: #405b35;
}

.town-map-label.quiet-plot {
  min-width: 44px;
  min-height: 44px;
  width: 44px;
  padding: 4px;
  background: #f7f1dcdd;
  border: 1px solid #a9a88c;
  box-shadow: none;
  color: #465b4a;
}
.town-map-label.quiet-plot .plot-name,
.town-map-label.quiet-plot small,
.town-map-label.quiet-plot > span:last-child:not(.plot-name) {
  display: none;
}
.town-map-label.quiet-plot:hover,
.town-map-label.quiet-plot:focus-visible {
  width: auto;
}
.town-map-label.quiet-plot:hover .plot-name,
.town-map-label.quiet-plot:focus-visible .plot-name {
  display: inline;
}
.town-map-label.suggested-plot {
  background: #f7dfa1;
  border: 2px solid #896629;
  color: #3e4e35;
}
.town-map-label .plot-name,
.town-map-label small {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.town-map-label .plot-name {
  font-weight: normal;
}
.town-map-label .construction-count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
</style>
