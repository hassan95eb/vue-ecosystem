import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import {
  addJalaliMonths,
  dateToJalali,
  jalaliDayOfWeek,
  type JalaliDateParts,
} from '../internal/jalali-core'
import { JALALI_MONTH_NAMES, JALALI_WEEKDAY_NAMES } from '../internal/jalali-format'
import {
  clampJalaliRange,
  compareJalaliDate,
  formatJalaliRange,
  isJalaliDateInRange,
  isJalaliDateWithinBounds,
  jalaliMonthDays,
  normalizeJalaliRange,
  type FormatJalaliRangeOptions,
  type JalaliRange,
} from '../internal/jalali-range'

export interface UseDateRangePickerOptions {
  /** Earliest selectable date, inclusive. Unbounded when omitted. */
  readonly min?: MaybeRefOrGetter<JalaliDateParts | undefined>
  /** Latest selectable date, inclusive. Unbounded when omitted. */
  readonly max?: MaybeRefOrGetter<JalaliDateParts | undefined>
  /** Initial range. Default both ends unset. */
  readonly modelValue?: MaybeRefOrGetter<JalaliRange | undefined>
  /** Month the calendar view opens on. Default: `start`, or today. */
  readonly initialView?: MaybeRefOrGetter<JalaliDateParts | undefined>
  /** Pattern used by `formatted`. Default `'YYYY/MM/DD'`. */
  readonly pattern?: MaybeRefOrGetter<string | undefined>
  readonly persianDigits?: MaybeRefOrGetter<boolean | undefined>
}

export interface UseDateRangePickerReturn {
  /** The current range. Either or both ends may be `null`. */
  readonly range: Ref<JalaliRange>
  readonly start: ComputedRef<JalaliDateParts | null>
  readonly end: ComputedRef<JalaliDateParts | null>
  /** `true` once both ends are set. */
  readonly isComplete: ComputedRef<boolean>
  readonly formatted: ComputedRef<string>

  /** Jalali year/month the calendar grid is currently showing. */
  readonly viewYear: Ref<number>
  readonly viewMonth: Ref<number>
  readonly viewMonthName: ComputedRef<string>
  /** Every day of the viewed month, in order. */
  readonly viewDays: ComputedRef<JalaliDateParts[]>
  /** Blank cells before the 1st, so the grid lines up with the weekday header. */
  readonly leadingBlanks: ComputedRef<number>
  readonly weekdayNames: readonly string[]

  readonly goToNextMonth: () => void
  readonly goToPreviousMonth: () => void
  readonly goToMonth: (jy: number, jm: number) => void

  /**
   * Click-to-select flow: the first call after a complete (or empty) range
   * starts a new range at `date`; the second call completes it, clamped to
   * `min`/`max` and normalised so `start <= end` regardless of click order.
   */
  readonly select: (date: JalaliDateParts) => void
  readonly clear: () => void

  readonly isSelected: (date: JalaliDateParts) => boolean
  readonly isRangeStart: (date: JalaliDateParts) => boolean
  readonly isRangeEnd: (date: JalaliDateParts) => boolean
  readonly isInRange: (date: JalaliDateParts) => boolean
  readonly isDisabled: (date: JalaliDateParts) => boolean
}

/**
 * Headless, framework-thin range-picker state machine over the pure functions
 * in `internal/jalali-range.ts`. `PersianDateRangePicker.vue` is the styled
 * shell built on top of this; use this composable directly for a fully custom
 * UI.
 */
export function useDateRangePicker(
  options: UseDateRangePickerOptions = {},
): UseDateRangePickerReturn {
  const min = computed(() => toValue(options.min))
  const max = computed(() => toValue(options.max))
  const pattern = computed(() => toValue(options.pattern) ?? 'YYYY/MM/DD')
  const persianDigits = computed(() => toValue(options.persianDigits) ?? true)

  const initial = toValue(options.modelValue) ?? { start: null, end: null }
  const range = ref<JalaliRange>(
    clampJalaliRange(initial, min.value, max.value),
  ) as Ref<JalaliRange>

  const initialView = toValue(options.initialView) ?? initial.start ?? dateToJalali(new Date())
  const viewYear = ref(initialView.jy)
  const viewMonth = ref(initialView.jm)

  function goToMonth(jy: number, jm: number): void {
    // Route through addJalaliMonths(0-based-total) so a 13th/0th month
    // normalises into the adjacent year instead of needing bespoke overflow
    // handling here.
    const normalised = addJalaliMonths({ jy, jm: 1, jd: 1 }, jm - 1)
    viewYear.value = normalised.jy
    viewMonth.value = normalised.jm
  }

  return {
    range,
    start: computed(() => range.value.start),
    end: computed(() => range.value.end),
    isComplete: computed(() => range.value.start !== null && range.value.end !== null),
    formatted: computed(() => {
      const formatOptions: FormatJalaliRangeOptions = { persianDigits: persianDigits.value }
      return formatJalaliRange(range.value, pattern.value, formatOptions)
    }),

    viewYear,
    viewMonth,
    viewMonthName: computed(() => JALALI_MONTH_NAMES[viewMonth.value - 1] ?? ''),
    viewDays: computed(() => jalaliMonthDays(viewYear.value, viewMonth.value)),
    leadingBlanks: computed(() =>
      jalaliDayOfWeek({ jy: viewYear.value, jm: viewMonth.value, jd: 1 }),
    ),
    weekdayNames: JALALI_WEEKDAY_NAMES,

    goToNextMonth: () => goToMonth(viewYear.value, viewMonth.value + 1),
    goToPreviousMonth: () => goToMonth(viewYear.value, viewMonth.value - 1),
    goToMonth,

    select(date: JalaliDateParts): void {
      const clamped = clampJalaliRange({ start: date, end: date }, min.value, max.value).start
      if (clamped === null) return

      const current = range.value
      const startingFresh = current.start === null || current.end !== null
      if (startingFresh) {
        range.value = { start: clamped, end: null }
        return
      }

      range.value = normalizeJalaliRange(
        clampJalaliRange({ start: current.start, end: clamped }, min.value, max.value),
      )
    },

    clear(): void {
      range.value = { start: null, end: null }
    },

    isSelected: (date) =>
      (range.value.start !== null && compareJalaliDate(date, range.value.start) === 0) ||
      (range.value.end !== null && compareJalaliDate(date, range.value.end) === 0),
    isRangeStart: (date) =>
      range.value.start !== null && compareJalaliDate(date, range.value.start) === 0,
    isRangeEnd: (date) =>
      range.value.end !== null && compareJalaliDate(date, range.value.end) === 0,
    isInRange: (date) => isJalaliDateInRange(date, range.value),
    isDisabled: (date) => !isJalaliDateWithinBounds(date, min.value, max.value),
  }
}

// Re-exported for convenience: `range: Ref<JalaliRange>` above means a
// consumer typing their own local state needs this without a second import
// from `internal/`.
export type { JalaliRange }
