<script setup lang="ts">
/**
 * Small presentational component over `formatJalaliRelative` -- renders
 * `'۳ روز پیش'`-style text, with the absolute date as a `title` tooltip and
 * `datetime` attribute on the underlying `<time>` element.
 */
import { computed } from 'vue'
import { formatJalaliRelative } from '../internal/jalali-relative'
import { formatJalali } from '../internal/jalali-format'
import { jalaliToGregorian, type JalaliDateParts } from '../internal/jalali-core'

export interface RelativeDateProps {
  readonly date: JalaliDateParts
  /** The date `date` is measured relative to. Default: now. */
  readonly now?: Date
  /** Render digits in Persian. Default `true`. */
  readonly persianDigits?: boolean
  /** Pattern for the `title` tooltip. Default `'YYYY/MM/DD'`. */
  readonly titlePattern?: string
  /** Text direction. Default `true` (RTL) -- set `false` inside an LTR page. */
  readonly rtl?: boolean
}

const props = withDefaults(defineProps<RelativeDateProps>(), {
  now: undefined,
  persianDigits: true,
  titlePattern: 'YYYY/MM/DD',
  rtl: true,
})

const relative = computed(() =>
  formatJalaliRelative(props.date, { now: props.now, persianDigits: props.persianDigits }),
)
const absolute = computed(() =>
  formatJalali(props.date, props.titlePattern, { persianDigits: props.persianDigits }),
)
const isoDate = computed(() => {
  const { gy, gm, gd } = jalaliToGregorian(props.date.jy, props.date.jm, props.date.jd)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(gy)}-${pad(gm)}-${pad(gd)}`
})
</script>

<template>
  <time class="vet-relative-date" :dir="rtl ? 'rtl' : 'ltr'" :datetime="isoDate" :title="absolute">
    <slot :relative="relative" :absolute="absolute">{{ relative }}</slot>
  </time>
</template>

<style scoped>
.vet-relative-date {
  --vet-relative-text: currentColor;
  color: var(--vet-relative-text);
  font-variant-numeric: tabular-nums;
}
</style>
