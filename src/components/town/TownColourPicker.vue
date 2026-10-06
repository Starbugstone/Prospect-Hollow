<template>
  <fieldset class="personal-colours">
    <legend>{{ label }}</legend>
    <div class="personal-swatches">
      <button
        v-for="colour in PAINT_COLOURS"
        :key="colour"
        type="button"
        :style="{ '--swatch': colour }"
        :aria-label="t('Choose colour {colour}', { colour })"
        :aria-pressed="modelValue === colour"
        @click="$emit('update:modelValue', colour)"
      >
        <span v-if="modelValue === colour">✓</span>
      </button>
    </div>
    <div class="personal-custom-colour">
      <label
        >{{ t('Custom colour')
        }}<input
          type="color"
          :aria-label="label + ' · ' + t('Custom colour')"
          :value="modelValue || '#658c68'"
          @input="$emit('update:modelValue', $event.target.value)"
      /></label>
      <button
        v-if="resettable"
        type="button"
        class="personal-text-button"
        @click="$emit('update:modelValue', null)"
      >
        {{ t('Original colour') }}
      </button>
    </div>
  </fieldset>
</template>
<script setup>
import { PAINT_COLOURS } from '../../data/townPersonalisation';
import { t } from '../../i18n';
defineProps({ label: String, modelValue: String, resettable: Boolean });
defineEmits(['update:modelValue']);
</script>
