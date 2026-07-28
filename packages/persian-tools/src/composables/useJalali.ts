import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import {
  addJalaliDays,
  addJalaliMonths,
  dateToJalali,
  isLeapJalaliYear,
  isValidJalaliDate,
  jalaliDayOfWeek,
  jalaliDayOfYear,
  jalaliMonthLength,
  jalaliToDate,
  type JalaliDateParts,
} from '../internal/jalali-core'
import {
  formatJalali,
  parseJalali,
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAY_NAMES,
} from '../internal/jalali-format'
import { invalidJalaliDate } from '../internal/errors'

/** Anything the composable will accept as a date. */
export type JalaliInput = Date | JalaliDateParts | string | number

export interface UseJalaliOptions {
  /** Default pattern for `formatted`. Default `'YYYY/MM/DD'`. */
  readonly pattern?: MaybeRefOrGetter<string>
  /** Render digits in Persian. Default `true`. */
  readonly persianDigits?: MaybeRefOrGetter<boolean>
}

export interface UseJalaliReturn {
  readonly parts: ComputedRef<JalaliDateParts>
  readonly year: ComputedRef<number>
  readonly month: ComputedRef<number>
  readonly day: ComputedRef<number>
  /** Month name, e.g. `فروردین`. */
  readonly monthName: ComputedRef<string>
  /** Weekday name, e.g. `شنبه`. */
  readonly weekdayName: ComputedRef<string>
  /** 0 = Saturday .. 6 = Friday. */
  readonly dayOfWeek: ComputedRef<number>
  readonly dayOfYear: ComputedRef<number>
  readonly daysInMonth: ComputedRef<number>
  readonly isLeapYear: ComputedRef<boolean>
  /** The source date as a Gregorian `Date` at local midnight. */
  readonly gregorian: ComputedRef<Date>
  /** Formatted with the composable's default pattern. */
  readonly formatted: ComputedRef<string>
  /** Format with an ad-hoc pattern. */
  readonly format: (pattern: string) => string
  readonly addDays: (days: number) => JalaliDateParts
  readonly addMonths: (months: number) => JalaliDateParts
}

function normalise(input: JalaliInput): JalaliDateParts {
  if (input instanceof Date) return dateToJalali(input)
  if (typeof input === 'number') return dateToJalali(new Date(input))
  if (typeof input === 'string') {
    const parsed = parseJalali(input)
    if (parsed !== null && isValidJalaliDate(parsed.jy, parsed.jm, parsed.jd)) return parsed
    const asDate = new Date(input)
    if (!Number.isNaN(asDate.getTime())) return dateToJalali(asDate)
    throw invalidJalaliDate(Number.NaN, Number.NaN, Number.NaN)
  }
  if (!isValidJalaliDate(input.jy, input.jm, input.jd)) {
    throw invalidJalaliDate(input.jy, input.jm, input.jd)
  }
  return input
}

/**
 * Reactive view over a Jalali date.
 *
 * This is a thin wrapper: all arithmetic lives in the pure layer exported from
 * `@vue-ecosystem/persian-tools/jalali`, which is usable without Vue.
 *
 * ```ts
 * const { formatted, monthName } = useJalali(() => new Date(), { pattern: 'D MMMM YYYY' })
 * ```
 */
export function useJalali(
  source: MaybeRefOrGetter<JalaliInput>,
  options: UseJalaliOptions = {},
): UseJalaliReturn {
  const parts = computed(() => normalise(toValue(source)))
  const persianDigits = computed(() => toValue(options.persianDigits) ?? true)
  const pattern = computed(() => toValue(options.pattern) ?? 'YYYY/MM/DD')

  const format = (custom: string): string =>
    formatJalali(parts.value, custom, { persianDigits: persianDigits.value })

  return {
    parts,
    year: computed(() => parts.value.jy),
    month: computed(() => parts.value.jm),
    day: computed(() => parts.value.jd),
    monthName: computed(() => JALALI_MONTH_NAMES[parts.value.jm - 1] ?? ''),
    weekdayName: computed(() => JALALI_WEEKDAY_NAMES[jalaliDayOfWeek(parts.value)] ?? ''),
    dayOfWeek: computed(() => jalaliDayOfWeek(parts.value)),
    dayOfYear: computed(() => jalaliDayOfYear(parts.value)),
    daysInMonth: computed(() => jalaliMonthLength(parts.value.jy, parts.value.jm)),
    isLeapYear: computed(() => isLeapJalaliYear(parts.value.jy)),
    gregorian: computed(() => jalaliToDate(parts.value.jy, parts.value.jm, parts.value.jd)),
    formatted: computed(() =>
      formatJalali(parts.value, pattern.value, { persianDigits: persianDigits.value }),
    ),
    format,
    addDays: (days: number): JalaliDateParts => addJalaliDays(parts.value, days),
    addMonths: (months: number): JalaliDateParts => addJalaliMonths(parts.value, months),
  }
}
