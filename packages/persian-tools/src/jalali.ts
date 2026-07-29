// Public entry for the framework-agnostic calendar layer.
// Importable on its own: `@vue-ecosystem/persian-tools/jalali` -- no Vue required.

export {
  gregorianToJalali,
  jalaliToGregorian,
  dateToJalali,
  jalaliToDate,
  isLeapJalaliYear,
  jalaliMonthLength,
  isValidJalaliDate,
  addJalaliDays,
  addJalaliMonths,
  jalaliDayOfWeek,
  jalaliDayOfYear,
  MIN_JALALI_YEAR,
  MAX_JALALI_YEAR,
} from './internal/jalali-core'
export type { JalaliDateParts, GregorianDateParts } from './internal/jalali-core'

export {
  formatJalali,
  parseJalali,
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAY_NAMES,
} from './internal/jalali-format'
export type { FormatJalaliOptions } from './internal/jalali-format'

export {
  getJalaliHoliday,
  isJalaliHoliday,
  FIXED_JALALI_HOLIDAYS,
} from './internal/jalali-holidays'
export type { JalaliHoliday } from './internal/jalali-holidays'

export { formatJalaliRelative, jalaliRelativeDayOffset } from './internal/jalali-relative'
export type { FormatJalaliRelativeOptions } from './internal/jalali-relative'
