/**
 * Framework-agnostic Jalali date-*range* logic: clamp, compare, validate,
 * format. Pure functions, zero Vue import -- `useDateRangePicker` is a thin
 * wrapper over these, the same split `jalali-core.ts` uses for single dates.
 *
 * Deliberately built *on top of* `jalali-core.ts` (via its exported
 * `jalaliToDate` / `addJalaliDays` / etc.) rather than reimplementing any
 * calendar arithmetic here -- a second Jalali-to-JDN conversion living in this
 * file would be exactly the kind of duplicated logic the leap-year edge cases
 * in `jalali-core.test.ts` exist to catch once, not twice.
 */
import {
  isValidJalaliDate,
  jalaliMonthLength,
  jalaliToDate,
  type JalaliDateParts,
} from './jalali-core'
import { formatJalali, type FormatJalaliOptions } from './jalali-format'

export interface JalaliRange {
  readonly start: JalaliDateParts | null
  readonly end: JalaliDateParts | null
}

/** `-1` when `a` is before `b`, `0` when equal, `1` when `a` is after `b`. */
export function compareJalaliDate(a: JalaliDateParts, b: JalaliDateParts): number {
  const diff = jalaliToDate(a.jy, a.jm, a.jd).getTime() - jalaliToDate(b.jy, b.jm, b.jd).getTime()
  return diff === 0 ? 0 : diff < 0 ? -1 : 1
}

/** Inclusive day count between `a` and `b`, regardless of order. `1` when equal. */
export function jalaliDateDiffInDays(a: JalaliDateParts, b: JalaliDateParts): number {
  const ms = jalaliToDate(b.jy, b.jm, b.jd).getTime() - jalaliToDate(a.jy, a.jm, a.jd).getTime()
  return Math.round(Math.abs(ms) / 86_400_000) + 1
}

/** Clamps `date` to `[min, max]` (either bound optional). Returns `date` unchanged if already inside. */
export function clampJalaliDate(
  date: JalaliDateParts,
  min?: JalaliDateParts,
  max?: JalaliDateParts,
): JalaliDateParts {
  if (min !== undefined && compareJalaliDate(date, min) < 0) return min
  if (max !== undefined && compareJalaliDate(date, max) > 0) return max
  return date
}

/** True when `min <= date <= max` (either bound optional -- unbounded on that side). */
export function isJalaliDateWithinBounds(
  date: JalaliDateParts,
  min?: JalaliDateParts,
  max?: JalaliDateParts,
): boolean {
  if (min !== undefined && compareJalaliDate(date, min) < 0) return false
  if (max !== undefined && compareJalaliDate(date, max) > 0) return false
  return true
}

/** True when `date` falls within `[range.start, range.end]`, inclusive. `false` if the range isn't complete. */
export function isJalaliDateInRange(date: JalaliDateParts, range: JalaliRange): boolean {
  if (range.start === null || range.end === null) return false
  const [lo, hi] =
    compareJalaliDate(range.start, range.end) <= 0
      ? [range.start, range.end]
      : [range.end, range.start]
  return compareJalaliDate(date, lo) >= 0 && compareJalaliDate(date, hi) <= 0
}

/**
 * Swaps `start`/`end` if they are out of order, so a range built by clicking
 * "the later date first" still reads correctly. A picker's UI concern
 * (letting either click come first) implemented as a pure function so the
 * composable layer doesn't have to.
 */
export function normalizeJalaliRange(range: JalaliRange): JalaliRange {
  if (range.start === null || range.end === null) return range
  return compareJalaliDate(range.start, range.end) <= 0
    ? range
    : { start: range.end, end: range.start }
}

/** Clamps both ends of `range` to `[min, max]` (either bound optional). */
export function clampJalaliRange(
  range: JalaliRange,
  min?: JalaliDateParts,
  max?: JalaliDateParts,
): JalaliRange {
  return {
    start: range.start === null ? null : clampJalaliDate(range.start, min, max),
    end: range.end === null ? null : clampJalaliDate(range.end, min, max),
  }
}

/** True when both ends are set and each is individually a valid Jalali date. */
export function isValidJalaliRange(range: JalaliRange): boolean {
  if (range.start === null || range.end === null) return false
  return (
    isValidJalaliDate(range.start.jy, range.start.jm, range.start.jd) &&
    isValidJalaliDate(range.end.jy, range.end.jm, range.end.jd)
  )
}

export interface FormatJalaliRangeOptions extends FormatJalaliOptions {
  /** Placed between the two formatted dates. Default `' – '` (en dash). */
  readonly separator?: string
  /** Used when a side of the range is `null`. Default `'…'`. */
  readonly placeholder?: string
}

/** Formats a range as `'{start}{separator}{end}'`, same token pattern as `formatJalali`. */
export function formatJalaliRange(
  range: JalaliRange,
  pattern = 'YYYY/MM/DD',
  options: FormatJalaliRangeOptions = {},
): string {
  const { separator = ' – ', placeholder = '…', ...formatOptions } = options
  const start =
    range.start === null ? placeholder : formatJalali(range.start, pattern, formatOptions)
  const end = range.end === null ? placeholder : formatJalali(range.end, pattern, formatOptions)
  return `${start}${separator}${end}`
}

/** Number of days visible before the 1st that belong to blank leading grid cells. */
export function jalaliLeadingBlankCount(dayOfWeekOfFirst: number): number {
  return dayOfWeekOfFirst
}

/** Every day of `jy`/`jm` as Jalali date parts, in order. */
export function jalaliMonthDays(jy: number, jm: number): JalaliDateParts[] {
  const length = jalaliMonthLength(jy, jm)
  return Array.from({ length }, (_, i) => ({ jy, jm, jd: i + 1 }))
}
