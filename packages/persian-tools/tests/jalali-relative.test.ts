import { describe, it, expect } from 'vitest'
import { dateToJalali, formatJalaliRelative, jalaliRelativeDayOffset } from '../src/jalali'

const NOW = new Date(2024, 2, 20) // 1403/01/01

describe('jalaliRelativeDayOffset', () => {
  it('is 0 for today, positive for the future, negative for the past', () => {
    expect(jalaliRelativeDayOffset(dateToJalali(NOW), NOW)).toBe(0)
    expect(jalaliRelativeDayOffset(dateToJalali(new Date(2024, 2, 21)), NOW)).toBe(1)
    expect(jalaliRelativeDayOffset(dateToJalali(new Date(2024, 2, 19)), NOW)).toBe(-1)
  })
})

describe('formatJalaliRelative', () => {
  it('special-cases today/tomorrow/yesterday', () => {
    expect(formatJalaliRelative(dateToJalali(NOW), { now: NOW })).toBe('امروز')
    expect(formatJalaliRelative(dateToJalali(new Date(2024, 2, 21)), { now: NOW })).toBe('فردا')
    expect(formatJalaliRelative(dateToJalali(new Date(2024, 2, 19)), { now: NOW })).toBe('دیروز')
  })

  it('uses a day count under a week', () => {
    expect(
      formatJalaliRelative(dateToJalali(new Date(2024, 2, 23)), { now: NOW, persianDigits: false }),
    ).toBe('3 روز دیگر')
    expect(
      formatJalaliRelative(dateToJalali(new Date(2024, 2, 17)), { now: NOW, persianDigits: false }),
    ).toBe('3 روز پیش')
  })

  it('widens to weeks, then months, then years', () => {
    expect(
      formatJalaliRelative(dateToJalali(new Date(2024, 3, 10)), { now: NOW, persianDigits: false }),
    ).toMatch(/هفته دیگر$/)
    expect(
      formatJalaliRelative(dateToJalali(new Date(2024, 6, 1)), { now: NOW, persianDigits: false }),
    ).toMatch(/ماه دیگر$/)
    expect(
      formatJalaliRelative(dateToJalali(new Date(2026, 2, 20)), { now: NOW, persianDigits: false }),
    ).toMatch(/سال دیگر$/)
  })

  it('renders the count in Persian digits by default', () => {
    expect(formatJalaliRelative(dateToJalali(new Date(2024, 2, 23)), { now: NOW })).toBe(
      '۳ روز دیگر',
    )
  })
})
