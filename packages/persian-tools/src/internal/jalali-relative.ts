/** Relative-time phrasing for Jalali dates ("۳ روز پیش", "فردا"). Pure, no Vue. */
import { jalaliToDate, type JalaliDateParts } from './jalali-core'
import { toPersianDigits } from './digits'

export interface FormatJalaliRelativeOptions {
  /** The date `date` is measured relative to. Default: now. */
  readonly now?: Date
  /** Render the day/week/month/year count in Persian digits. Default `true`. */
  readonly persianDigits?: boolean
}

const DAY_MS = 86_400_000

/**
 * Whole calendar days between `date` and `now`'s local calendar day
 * (`date` in the future is positive, in the past is negative).
 */
export function jalaliRelativeDayOffset(date: JalaliDateParts, now: Date = new Date()): number {
  const target = jalaliToDate(date.jy, date.jm, date.jd).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / DAY_MS)
}

/**
 * Formats `date` relative to `options.now` (default: today) as a short
 * Persian phrase -- `'امروز'`, `'فردا'`, `'دیروز'`, `'N روز دیگر'` /
 * `'N روز پیش'`, widening to weeks, months and years the further out `date`
 * is.
 */
export function formatJalaliRelative(
  date: JalaliDateParts,
  options: FormatJalaliRelativeOptions = {},
): string {
  const days = jalaliRelativeDayOffset(date, options.now ?? new Date())
  const persianDigits = options.persianDigits ?? true
  const n = (value: number): string => (persianDigits ? toPersianDigits(value) : String(value))

  if (days === 0) return 'امروز'
  if (days === 1) return 'فردا'
  if (days === -1) return 'دیروز'

  const abs = Math.abs(days)
  const future = days > 0

  if (abs < 7) return future ? `${n(abs)} روز دیگر` : `${n(abs)} روز پیش`
  if (abs < 30) {
    const weeks = Math.round(abs / 7)
    return future ? `${n(weeks)} هفته دیگر` : `${n(weeks)} هفته پیش`
  }
  if (abs < 365) {
    const months = Math.round(abs / 30)
    return future ? `${n(months)} ماه دیگر` : `${n(months)} ماه پیش`
  }
  const years = Math.round(abs / 365)
  return future ? `${n(years)} سال دیگر` : `${n(years)} سال پیش`
}
