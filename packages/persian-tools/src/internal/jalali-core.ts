/**
 * Framework-agnostic Jalali (Solar Hijri) calendar arithmetic.
 *
 * Pure functions, zero Vue import -- the composable layer in `../composables` is a
 * thin wrapper. That split is deliberate: `smart-table` will need the arithmetic
 * without pulling in reactivity.
 *
 * Algorithm: the 33-year-cycle "breaks" method (Khayyam / Birashk, as refined by
 * Borkowski). It is exact for the astronomically-observed Iranian calendar across
 * Jalali years -61..3177, rather than assuming a naive fixed 4-year leap rule --
 * which is precisely where naive implementations produce off-by-one-day bugs.
 */
import { invalidJalaliDate, unsupportedJalaliYear } from './errors'

export interface JalaliDateParts {
  readonly jy: number
  readonly jm: number
  readonly jd: number
}

export interface GregorianDateParts {
  readonly gy: number
  readonly gm: number
  readonly gd: number
}

/** Years at which the leap pattern shifts. Source of the algorithm's accuracy. */
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
] as const

export const MIN_JALALI_YEAR = -61
export const MAX_JALALI_YEAR = 3177

const div = (a: number, b: number): number => Math.trunc(a / b)
const mod = (a: number, b: number): number => a - Math.trunc(a / b) * b

function breakAt(index: number): number {
  const value = BREAKS[index]
  /* v8 ignore next -- unreachable: every call site stays inside BREAKS.length */
  if (value === undefined) throw unsupportedJalaliYear(index)
  return value
}

interface JalaliCalendarInfo {
  /** 0 when the year is a leap year; 1..3 otherwise (distance to previous leap). */
  readonly leap: number
  readonly gy: number
  /** Day of March (Gregorian) on which 1 Farvardin of `jy` falls. */
  readonly march: number
}

function jalaliCal(jy: number): JalaliCalendarInfo {
  if (!Number.isInteger(jy) || jy < MIN_JALALI_YEAR || jy > MAX_JALALI_YEAR) {
    throw unsupportedJalaliYear(jy)
  }

  const gy = jy + 621
  let leapJ = -14
  let jp = breakAt(0)
  let jump = 0

  for (let i = 1; i < BREAKS.length; i += 1) {
    const jm = breakAt(i)
    jump = jm - jp
    if (jy < jm) break
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }

  let n = jy - jp

  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4

  return { leap, gy, march }
}

/** True when `jy` is a Jalali leap year (Esfand has 30 days). */
export function isLeapJalaliYear(jy: number): boolean {
  return jalaliCal(jy).leap === 0
}

/** Number of days in a Jalali month. Months 1-6: 31, 7-11: 30, 12: 29 or 30. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (!Number.isInteger(jm) || jm < 1 || jm > 12) throw invalidJalaliDate(jy, jm, 1)
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isLeapJalaliYear(jy) ? 30 : 29
}

export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false
  if (jy < MIN_JALALI_YEAR || jy > MAX_JALALI_YEAR) return false
  if (jm < 1 || jm > 12) return false
  if (jd < 1) return false
  return jd <= jalaliMonthLength(jy, jm)
}

/** Gregorian calendar date -> Julian Day Number. */
function gregorianToJdn(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

/** Julian Day Number -> Gregorian calendar date. */
function jdnToGregorian(jdn: number): GregorianDateParts {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

function jalaliToJdn(jy: number, jm: number, jd: number): number {
  const { march, gy } = jalaliCal(jy)
  return gregorianToJdn(gy, 3, march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

function jdnToJalali(jdn: number): JalaliDateParts {
  const { gy } = jdnToGregorian(jdn)
  let jy = gy - 621
  const info = jalaliCal(jy)
  const farvardin1Jdn = gregorianToJdn(info.gy, 3, info.march)

  let k = jdn - farvardin1Jdn
  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }
    }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (info.leap === 1) k += 1
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }
}

/** Gregorian date parts -> Jalali date parts. */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDateParts {
  return jdnToJalali(gregorianToJdn(gy, gm, gd))
}

/** Jalali date parts -> Gregorian date parts. Throws on an invalid Jalali date. */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDateParts {
  if (!isValidJalaliDate(jy, jm, jd)) throw invalidJalaliDate(jy, jm, jd)
  return jdnToGregorian(jalaliToJdn(jy, jm, jd))
}

/**
 * `Date` -> Jalali parts, read in the host's local time zone.
 * Convert the `Date` yourself first if you need another zone -- silently guessing
 * one is how date libraries end up a day out.
 */
export function dateToJalali(date: Date): JalaliDateParts {
  if (Number.isNaN(date.getTime())) {
    throw invalidJalaliDate(Number.NaN, Number.NaN, Number.NaN)
  }
  return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** Jalali parts -> `Date` at local midnight. */
export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd)
  const date = new Date(gy, gm - 1, gd, 0, 0, 0, 0)
  // Years 0-99 are remapped to 1900-1999 by the Date constructor; undo that.
  if (gy >= 0 && gy < 100) date.setFullYear(gy)
  return date
}

/** Adds (or subtracts, with a negative value) whole days. */
export function addJalaliDays(parts: JalaliDateParts, days: number): JalaliDateParts {
  return jdnToJalali(jalaliToJdn(parts.jy, parts.jm, parts.jd) + Math.trunc(days))
}

/**
 * Adds months, clamping the day to the target month's length so that
 * 31 Farvardin + 6 months lands on 30 Mehr rather than rolling into Aban.
 */
export function addJalaliMonths(parts: JalaliDateParts, months: number): JalaliDateParts {
  const total = parts.jy * 12 + (parts.jm - 1) + Math.trunc(months)
  const jy = Math.floor(total / 12)
  const jm = total - jy * 12 + 1
  const jd = Math.min(parts.jd, jalaliMonthLength(jy, jm))
  return { jy, jm, jd }
}

/** Day of week, 0 = Saturday (شنبه) .. 6 = Friday (جمعه). */
export function jalaliDayOfWeek(parts: JalaliDateParts): number {
  const { gy, gm, gd } = jalaliToGregorian(parts.jy, parts.jm, parts.jd)
  const date = new Date(gy, gm - 1, gd)
  if (gy >= 0 && gy < 100) date.setFullYear(gy)
  return (date.getDay() + 1) % 7
}

/** 1-based day of the Jalali year (1..365 or 366). */
export function jalaliDayOfYear(parts: JalaliDateParts): number {
  if (!isValidJalaliDate(parts.jy, parts.jm, parts.jd)) {
    throw invalidJalaliDate(parts.jy, parts.jm, parts.jd)
  }
  let days = parts.jd
  for (let m = 1; m < parts.jm; m += 1) days += jalaliMonthLength(parts.jy, m)
  return days
}
