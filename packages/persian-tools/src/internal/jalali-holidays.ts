/**
 * Fixed-date Iranian solar-calendar holidays. Pure, no Vue. Kept in its own
 * module, separate from `jalali-core.ts` -- holiday *data* is not calendar
 * *arithmetic*, and the two churn for unrelated reasons (a new year's holiday
 * list vs. a calendar algorithm correctness fix).
 *
 * ## Scope note -- read before adding a date or relying on this for "is today
 * ## a day off"
 *
 * This module covers only holidays whose Jalali month/day is fixed from year
 * to year: Nowruz and the 20th-century anniversaries the Islamic Republic
 * calendar marks by solar date (e.g. 22 Bahman, 14/15 Khordad).
 *
 * It does **not** cover the Hijri-lunar religious holidays -- Eid al-Fitr,
 * Eid al-Adha, Ashura, Tasua, Eid al-Ghadir, Mab'ath, and others. Those move
 * by roughly 11 Jalali days every year because the Hijri calendar is lunar;
 * placing them correctly needs a Hijri<->Jalali conversion table, which is
 * out of scope for this MVP-completion pass (see the task's constraint
 * against a11y/i18n/v1.0 scope creep). `isJalaliHoliday` will under-report
 * holidays for this reason -- it answers "is this a *fixed* holiday", not
 * "is this a day off".
 */
import type { JalaliDateParts } from './jalali-core'

export interface JalaliHoliday {
  readonly month: number
  readonly day: number
  readonly title: string
}

export const FIXED_JALALI_HOLIDAYS: readonly JalaliHoliday[] = [
  { month: 1, day: 1, title: 'نوروز' },
  { month: 1, day: 2, title: 'نوروز' },
  { month: 1, day: 3, title: 'نوروز' },
  { month: 1, day: 4, title: 'نوروز' },
  { month: 1, day: 12, title: 'روز جمهوری اسلامی' },
  { month: 1, day: 13, title: 'روز طبیعت' },
  { month: 3, day: 14, title: 'رحلت امام خمینی' },
  { month: 3, day: 15, title: 'قیام ۱۵ خرداد' },
  { month: 11, day: 22, title: 'پیروزی انقلاب اسلامی' },
  { month: 12, day: 29, title: 'ملی شدن صنعت نفت' },
] as const

/** The fixed holiday on `date`'s month/day, if any. Year is ignored -- see module doc. */
export function getJalaliHoliday(date: Pick<JalaliDateParts, 'jm' | 'jd'>): JalaliHoliday | null {
  return FIXED_JALALI_HOLIDAYS.find((h) => h.month === date.jm && h.day === date.jd) ?? null
}

/** True when `date`'s month/day matches a fixed holiday. See module doc for what this excludes. */
export function isJalaliHoliday(date: Pick<JalaliDateParts, 'jm' | 'jd'>): boolean {
  return getJalaliHoliday(date) !== null
}
