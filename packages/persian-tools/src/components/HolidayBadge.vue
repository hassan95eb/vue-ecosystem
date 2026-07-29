<script setup lang="ts">
/**
 * Small presentational component over `getJalaliHoliday` -- renders nothing
 * when the given date is not a (fixed-date) holiday. See the scope note in
 * `internal/jalali-holidays.ts` for what "holiday" means here.
 */
import { computed } from 'vue'
import { getJalaliHoliday } from '../internal/jalali-holidays'
import type { JalaliDateParts } from '../internal/jalali-core'

export interface HolidayBadgeProps {
  readonly date: Pick<JalaliDateParts, 'jm' | 'jd'>
  /** Text direction. Default `true` (RTL) -- set `false` inside an LTR page. */
  readonly rtl?: boolean
}

const props = withDefaults(defineProps<HolidayBadgeProps>(), { rtl: true })

const holiday = computed(() => getJalaliHoliday(props.date))
</script>

<template>
  <span v-if="holiday" class="vet-holiday-badge" :dir="rtl ? 'rtl' : 'ltr'">
    <slot :holiday="holiday">{{ holiday.title }}</slot>
  </span>
</template>

<style scoped>
.vet-holiday-badge {
  --vet-badge-bg: #fdecec;
  --vet-badge-text: #b02a37;
  --vet-badge-radius: 999px;

  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 550;
  line-height: 1.6;
  color: var(--vet-badge-text);
  background: var(--vet-badge-bg);
  border-radius: var(--vet-badge-radius);
  white-space: nowrap;
}

/* Dark mode via the same custom properties -- see PersianDateRangePicker.vue
   for the same pattern with a longer explanation. */
@media (prefers-color-scheme: dark) {
  .vet-holiday-badge {
    --vet-badge-bg: #3a2224;
    --vet-badge-text: #f2a6ab;
  }
}
</style>
