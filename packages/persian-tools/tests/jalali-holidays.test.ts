import { describe, it, expect } from 'vitest'
import { getJalaliHoliday, isJalaliHoliday, FIXED_JALALI_HOLIDAYS } from '../src/jalali'
import type { JalaliDateParts } from '../src/jalali'

describe('getJalaliHoliday / isJalaliHoliday', () => {
  it('recognises Nowruz regardless of year', () => {
    expect(isJalaliHoliday({ jm: 1, jd: 1 })).toBe(true)
    expect(getJalaliHoliday({ jm: 1, jd: 1 })?.title).toBe('نوروز')
    // Year is ignored -- a full JalaliDateParts (with `jy`) works too, since
    // `Pick<JalaliDateParts, 'jm' | 'jd'>` is a structural subset.
    const full: JalaliDateParts = { jy: 1350, jm: 1, jd: 1 }
    expect(getJalaliHoliday(full)?.title).toBe('نوروز')
  })

  it('recognises other fixed anniversaries', () => {
    expect(isJalaliHoliday({ jm: 11, jd: 22 })).toBe(true) // Islamic Revolution
    expect(isJalaliHoliday({ jm: 12, jd: 29 })).toBe(true) // Oil nationalization
  })

  it('returns null / false for a non-holiday date', () => {
    expect(getJalaliHoliday({ jm: 6, jd: 15 })).toBeNull()
    expect(isJalaliHoliday({ jm: 6, jd: 15 })).toBe(false)
  })

  it('every entry has a month in 1..12 and a day in 1..31', () => {
    for (const holiday of FIXED_JALALI_HOLIDAYS) {
      expect(holiday.month).toBeGreaterThanOrEqual(1)
      expect(holiday.month).toBeLessThanOrEqual(12)
      expect(holiday.day).toBeGreaterThanOrEqual(1)
      expect(holiday.day).toBeLessThanOrEqual(31)
    }
  })
})
