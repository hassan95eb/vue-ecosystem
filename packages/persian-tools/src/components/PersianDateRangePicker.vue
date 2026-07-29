<script setup lang="ts">
/**
 * Styled shell over `useDateRangePicker` (the headless core). All date
 * arithmetic and selection state live in the composable / `internal/jalali-range.ts`;
 * this component is presentation plus two slots for swapping the parts most
 * consumers actually want to customise -- see `internal/jalali-range.ts` and
 * `composables/useDateRangePicker.ts` for the framework-agnostic and headless
 * layers this sits on top of.
 */
import { computed, watch } from 'vue'
import { useDateRangePicker } from '../composables/useDateRangePicker'
import { JALALI_MONTH_NAMES } from '../internal/jalali-format'
import type { JalaliDateParts } from '../internal/jalali-core'
import type { JalaliRange } from '../internal/jalali-range'

export interface PersianDateRangePickerProps {
  /**
   * Initial range. This component is v-model compatible for the common
   * "bind once, read `update:modelValue`" case, but selection state after
   * mount is owned internally -- see the README for the fully-controlled
   * alternative (`clear` / `select`, exposed via a template ref).
   */
  readonly modelValue?: JalaliRange
  /** Earliest selectable date, inclusive. Unbounded when omitted. */
  readonly min?: JalaliDateParts
  /** Latest selectable date, inclusive. Unbounded when omitted. */
  readonly max?: JalaliDateParts
  /** Month the calendar opens on. Default: the range's start, or today. */
  readonly initialView?: JalaliDateParts
  /** Text direction. Default `true` (RTL) -- set `false` inside an LTR page. */
  readonly rtl?: boolean
  /** Pattern for the built-in footer summary. Default `'YYYY/MM/DD'`. */
  readonly pattern?: string
  /** Render digits in Persian. Default `true`. */
  readonly persianDigits?: boolean
}

const props = withDefaults(defineProps<PersianDateRangePickerProps>(), {
  modelValue: undefined,
  min: undefined,
  max: undefined,
  initialView: undefined,
  rtl: true,
  pattern: undefined,
  persianDigits: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [range: JalaliRange] }>()

const picker = useDateRangePicker({
  modelValue: props.modelValue,
  min: computed(() => props.min),
  max: computed(() => props.max),
  initialView: computed(() => props.initialView),
  pattern: computed(() => props.pattern),
  persianDigits: computed(() => props.persianDigits),
})

watch(picker.range, (value) => emit('update:modelValue', value), { deep: true })

// Backs the default header's year <select> -- respects min/max when given so
// the list never offers a year outside what's actually selectable, and
// otherwise falls back to a fixed window around the viewed year.
const yearOptions = computed(() => {
  const base = picker.viewYear.value
  const lo = props.min?.jy ?? base - 10
  const hi = props.max?.jy ?? base + 10
  const years: number[] = []
  for (let y = lo; y <= hi; y += 1) years.push(y)
  return years
})

defineExpose({
  range: picker.range,
  select: picker.select,
  clear: picker.clear,
})
</script>

<template>
  <div class="vet-drp" :dir="rtl ? 'rtl' : 'ltr'">
    <slot
      name="header"
      :view-year="picker.viewYear.value"
      :view-month="picker.viewMonth.value"
      :view-month-name="picker.viewMonthName.value"
      :go-to-previous-month="picker.goToPreviousMonth"
      :go-to-next-month="picker.goToNextMonth"
      :go-to-month="picker.goToMonth"
    >
      <div class="vet-drp__header">
        <button
          type="button"
          class="vet-drp__nav"
          :aria-label="rtl ? 'ماه قبل' : 'Previous month'"
          @click="picker.goToPreviousMonth()"
        >
          {{ rtl ? '›' : '‹' }}
        </button>

        <div class="vet-drp__selects">
          <select
            class="vet-drp__select"
            :value="picker.viewMonth.value"
            :aria-label="rtl ? 'ماه' : 'Month'"
            @change="
              picker.goToMonth(
                picker.viewYear.value,
                Number(($event.target as HTMLSelectElement).value),
              )
            "
          >
            <option v-for="(name, i) in JALALI_MONTH_NAMES" :key="name" :value="i + 1">
              {{ name }}
            </option>
          </select>
          <select
            class="vet-drp__select"
            :value="picker.viewYear.value"
            :aria-label="rtl ? 'سال' : 'Year'"
            @change="
              picker.goToMonth(
                Number(($event.target as HTMLSelectElement).value),
                picker.viewMonth.value,
              )
            "
          >
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <button
          type="button"
          class="vet-drp__nav"
          :aria-label="rtl ? 'ماه بعد' : 'Next month'"
          @click="picker.goToNextMonth()"
        >
          {{ rtl ? '‹' : '›' }}
        </button>
      </div>
    </slot>

    <div class="vet-drp__weekdays">
      <span v-for="name in picker.weekdayNames" :key="name" class="vet-drp__weekday">
        {{ name[0] }}
      </span>
    </div>

    <div class="vet-drp__grid">
      <span v-for="b in picker.leadingBlanks.value" :key="`blank-${b}`" class="vet-drp__blank" />
      <slot
        v-for="date in picker.viewDays.value"
        :key="`${date.jy}-${date.jm}-${date.jd}`"
        name="day"
        :date="date"
        :is-selected="picker.isSelected(date)"
        :is-range-start="picker.isRangeStart(date)"
        :is-range-end="picker.isRangeEnd(date)"
        :is-in-range="picker.isInRange(date)"
        :is-disabled="picker.isDisabled(date)"
        :select="() => picker.select(date)"
      >
        <button
          type="button"
          class="vet-drp__day"
          :class="{
            'vet-drp__day--selected': picker.isSelected(date),
            'vet-drp__day--in-range': picker.isInRange(date),
            'vet-drp__day--start': picker.isRangeStart(date),
            'vet-drp__day--end': picker.isRangeEnd(date),
          }"
          :disabled="picker.isDisabled(date)"
          @click="picker.select(date)"
        >
          {{ date.jd }}
        </button>
      </slot>
    </div>

    <p class="vet-drp__summary">{{ picker.formatted.value }}</p>
  </div>
</template>

<style scoped>
/**
 * Every colour/spacing/radius value below has a fallback baked in via
 * `var(--token, fallback)`, so the component looks reasonable with zero
 * configuration -- but a host app's design system can override any of them
 * by setting the same custom properties on an ancestor.
 */
.vet-drp {
  --vet-drp-surface: #ffffff;
  --vet-drp-surface-sunken: #f2f4f7;
  --vet-drp-border: #e3e6ec;
  --vet-drp-text: #14161a;
  --vet-drp-text-muted: #666e7e;
  --vet-drp-accent: #4338ca;
  --vet-drp-accent-contrast: #ffffff;
  --vet-drp-range-bg: #eef1ff;
  --vet-drp-radius: 12px;
  --vet-drp-radius-sm: 8px;
  --vet-drp-space-1: 0.25rem;
  --vet-drp-space-2: 0.5rem;
  --vet-drp-space-3: 0.75rem;

  max-width: 20rem;
  padding: var(--vet-drp-space-3);
  background: var(--vet-drp-surface);
  border: 1px solid var(--vet-drp-border);
  border-radius: var(--vet-drp-radius);
  color: var(--vet-drp-text);
  font: inherit;
}

/* Dark mode is driven entirely by re-pointing the same custom properties --
   no duplicated rules below this block. A host app can instead scope this
   media query away and drive the same variables from a `.dark` class. */
@media (prefers-color-scheme: dark) {
  .vet-drp {
    --vet-drp-surface: #1c1e22;
    --vet-drp-surface-sunken: #17181b;
    --vet-drp-border: #33363c;
    --vet-drp-text: #f2f3f5;
    --vet-drp-text-muted: #9aa1ad;
    --vet-drp-accent: #8b7ff0;
    --vet-drp-accent-contrast: #14161a;
    --vet-drp-range-bg: #26265c;
  }
}

.vet-drp__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--vet-drp-space-3);
  font-weight: 650;
}

.vet-drp__nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  font: inherit;
  font-size: 1.1rem;
  line-height: 1;
  color: var(--vet-drp-text);
  background: transparent;
  border: 1px solid var(--vet-drp-border);
  border-radius: var(--vet-drp-radius-sm);
  cursor: pointer;
}

.vet-drp__nav:hover {
  background: var(--vet-drp-surface-sunken);
}

.vet-drp__selects {
  display: flex;
  gap: var(--vet-drp-space-1);
  min-width: 0;
}

.vet-drp__select {
  min-width: 0;
  padding: 0.25rem 0.4rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--vet-drp-text);
  background: var(--vet-drp-surface);
  border: 1px solid var(--vet-drp-border);
  border-radius: var(--vet-drp-radius-sm);
  cursor: pointer;
}

.vet-drp__weekdays,
.vet-drp__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--vet-drp-space-1);
}

.vet-drp__weekday {
  padding-bottom: var(--vet-drp-space-2);
  font-size: 0.75rem;
  font-weight: 550;
  text-align: center;
  color: var(--vet-drp-text-muted);
}

.vet-drp__day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font: inherit;
  color: var(--vet-drp-text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--vet-drp-radius-sm);
  cursor: pointer;
}

.vet-drp__day:hover:not(:disabled) {
  border-color: var(--vet-drp-border);
}

.vet-drp__day:disabled {
  color: var(--vet-drp-text-muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.vet-drp__day--in-range {
  background: var(--vet-drp-range-bg);
  border-radius: 0;
}

.vet-drp__day--start {
  border-start-start-radius: var(--vet-drp-radius-sm);
  border-end-start-radius: var(--vet-drp-radius-sm);
}

.vet-drp__day--end {
  border-start-end-radius: var(--vet-drp-radius-sm);
  border-end-end-radius: var(--vet-drp-radius-sm);
}

.vet-drp__day--selected {
  background: var(--vet-drp-accent);
  color: var(--vet-drp-accent-contrast);
  font-weight: 650;
}

.vet-drp__summary {
  margin: var(--vet-drp-space-3) 0 0;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: var(--vet-drp-text-muted);
  text-align: center;
}
</style>
