<template>
  <nav v-if="page > 1 || hasNext" class="admin-pager" aria-label="Pages">
    <button type="button" :disabled="page <= 1" @click="$emit('update:page', page - 1)">
      Previous
    </button>
    <span
      >Page {{ page }}<template v-if="pages"> of {{ pages }}</template></span
    >
    <button type="button" :disabled="!hasNext" @click="$emit('update:page', page + 1)">Next</button>
  </nav>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ page: Number, total: Number, pageSize: Number, next: Boolean });
defineEmits(['update:page']);
const pages = computed(() =>
  props.total != null ? Math.max(1, Math.ceil(props.total / props.pageSize)) : 0,
);
const hasNext = computed(() => (pages.value ? props.page < pages.value : props.next));
</script>
