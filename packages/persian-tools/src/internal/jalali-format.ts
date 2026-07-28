/** Display formatting for Jalali dates. Pure, no Vue. */
import { toPersianDigits } from './digits'
import { jalaliDayOfWeek, type JalaliDateParts } from './jalali-core'

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

/** Index 0 = Saturday, matching `jalaliDayOfWeek`. */
export const JALALI_WEEKDAY_NAMES = [
  'شنبه',
  'یک‌شنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const

export interface FormatJalaliOptions {
  /** Render digits in Persian. Default `true`. */
  readonly persianDigits?: boolean
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Formats Jalali parts against a token pattern.
 *
 * | Token  | Output                       |
 * |--------|------------------------------|
 * | `YYYY` | 4-digit year (`1403`)        |
 * | `YY`   | 2-digit year (`03`)          |
 * | `MMMM` | Month name (`فروردین`)       |
 * | `MM`   | Zero-padded month (`01`)     |
 * | `M`    | Month (`1`)                  |
 * | `DD`   | Zero-padded day (`05`)       |
 * | `D`    | Day (`5`)                    |
 * | `dddd` | Weekday name (`شنبه`)        |
 *
 * Text inside square brackets is emitted literally: `'[امروز] D MMMM'`.
 */
export function formatJalali(
  parts: JalaliDateParts,
  pattern = 'YYYY/MM/DD',
  options: FormatJalaliOptions = {},
): string {
  const monthName = JALALI_MONTH_NAMES[parts.jm - 1] ?? ''

  const out = pattern.replace(
    /\[([^\]]*)]|YYYY|YY|MMMM|MM|M|DD|D|dddd/g,
    (token, literal: string | undefined) => {
      if (literal !== undefined) return literal
      switch (token) {
        case 'YYYY':
          return String(parts.jy)
        case 'YY':
          return pad2(Math.abs(parts.jy) % 100)
        case 'MMMM':
          return monthName
        case 'MM':
          return pad2(parts.jm)
        case 'M':
          return String(parts.jm)
        case 'DD':
          return pad2(parts.jd)
        case 'D':
          return String(parts.jd)
        case 'dddd':
          return JALALI_WEEKDAY_NAMES[jalaliDayOfWeek(parts)] ?? ''
        /* v8 ignore next 2 -- the regex cannot produce another token */
        default:
          return token
      }
    },
  )

  return (options.persianDigits ?? true) ? toPersianDigits(out) : out
}

/**
 * Parses `YYYY/MM/DD` (also accepting `-` or `.` separators and Persian digits).
 * Returns `null` when the shape does not match; it does **not** validate that the
 * date exists -- pass the result to `isValidJalaliDate` for that.
 */
export function parseJalali(input: string): JalaliDateParts | null {
  const normalised = input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .trim()

  const match = /^(-?\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(normalised)
  if (match === null) return null

  return { jy: Number(match[1]), jm: Number(match[2]), jd: Number(match[3]) }
}
