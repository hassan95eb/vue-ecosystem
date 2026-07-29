import { describe, it, expect } from 'vitest'
import {
  clampJalaliDate,
  clampJalaliRange,
  compareJalaliDate,
  formatJalaliRange,
  isJalaliDateInRange,
  isJalaliDateWithinBounds,
  isValidJalaliRange,
  jalaliDateDiffInDays,
  jalaliMonthDays,
  normalizeJalaliRange,
} from '../src/internal/jalali-range'

const d = (jy: number, jm: number, jd: number) => ({ jy, jm, jd })

describe('compareJalaliDate', () => {
  it('orders dates correctly across a month/year boundary', () => {
    expect(compareJalaliDate(d(1403, 1, 1), d(1403, 1, 2))).toBe(-1)
    expect(compareJalaliDate(d(1403, 1, 2), d(1403, 1, 1))).toBe(1)
    expect(compareJalaliDate(d(1403, 1, 1), d(1403, 1, 1))).toBe(0)
    expect(compareJalaliDate(d(1403, 12, 29), d(1404, 1, 1))).toBe(-1)
  })
})

describe('jalaliDateDiffInDays', () => {
  it('is inclusive and order-independent', () => {
    expect(jalaliDateDiffInDays(d(1403, 1, 1), d(1403, 1, 1))).toBe(1)
    expect(jalaliDateDiffInDays(d(1403, 1, 1), d(1403, 1, 10))).toBe(10)
    expect(jalaliDateDiffInDays(d(1403, 1, 10), d(1403, 1, 1))).toBe(10)
  })
})

describe('clampJalaliDate / isJalaliDateWithinBounds', () => {
  const min = d(1403, 1, 10)
  const max = d(1403, 1, 20)

  it('passes values already inside the bounds through unchanged', () => {
    expect(clampJalaliDate(d(1403, 1, 15), min, max)).toEqual(d(1403, 1, 15))
    expect(isJalaliDateWithinBounds(d(1403, 1, 15), min, max)).toBe(true)
  })

  it('clamps below min and above max', () => {
    expect(clampJalaliDate(d(1403, 1, 5), min, max)).toEqual(min)
    expect(clampJalaliDate(d(1403, 1, 25), min, max)).toEqual(max)
    expect(isJalaliDateWithinBounds(d(1403, 1, 5), min, max)).toBe(false)
    expect(isJalaliDateWithinBounds(d(1403, 1, 25), min, max)).toBe(false)
  })

  it('is unbounded when a side is omitted', () => {
    expect(clampJalaliDate(d(1403, 1, 1), undefined, max)).toEqual(d(1403, 1, 1))
    expect(isJalaliDateWithinBounds(d(1300, 1, 1), undefined, undefined)).toBe(true)
  })
})

describe('normalizeJalaliRange', () => {
  it('swaps start/end when out of order', () => {
    expect(normalizeJalaliRange({ start: d(1403, 2, 1), end: d(1403, 1, 1) })).toEqual({
      start: d(1403, 1, 1),
      end: d(1403, 2, 1),
    })
  })

  it('leaves an in-order range untouched', () => {
    const range = { start: d(1403, 1, 1), end: d(1403, 2, 1) }
    expect(normalizeJalaliRange(range)).toEqual(range)
  })

  it('passes an incomplete range through unchanged', () => {
    expect(normalizeJalaliRange({ start: d(1403, 1, 1), end: null })).toEqual({
      start: d(1403, 1, 1),
      end: null,
    })
  })
})

describe('clampJalaliRange', () => {
  it('clamps both ends independently', () => {
    const min = d(1403, 1, 10)
    const max = d(1403, 1, 20)
    expect(clampJalaliRange({ start: d(1403, 1, 1), end: d(1403, 1, 30) }, min, max)).toEqual({
      start: min,
      end: max,
    })
  })

  it('leaves null ends as null', () => {
    expect(clampJalaliRange({ start: null, end: null }, d(1403, 1, 10))).toEqual({
      start: null,
      end: null,
    })
  })
})

describe('isJalaliDateInRange', () => {
  const range = { start: d(1403, 1, 10), end: d(1403, 1, 20) }

  it('is true for the endpoints and everything between', () => {
    expect(isJalaliDateInRange(d(1403, 1, 10), range)).toBe(true)
    expect(isJalaliDateInRange(d(1403, 1, 15), range)).toBe(true)
    expect(isJalaliDateInRange(d(1403, 1, 20), range)).toBe(true)
  })

  it('is false outside the range', () => {
    expect(isJalaliDateInRange(d(1403, 1, 9), range)).toBe(false)
    expect(isJalaliDateInRange(d(1403, 1, 21), range)).toBe(false)
  })

  it('tolerates a reversed range', () => {
    const reversed = { start: d(1403, 1, 20), end: d(1403, 1, 10) }
    expect(isJalaliDateInRange(d(1403, 1, 15), reversed)).toBe(true)
  })

  it('is false when the range is incomplete', () => {
    expect(isJalaliDateInRange(d(1403, 1, 15), { start: d(1403, 1, 10), end: null })).toBe(false)
  })
})

describe('isValidJalaliRange', () => {
  it('is true when both ends are valid dates', () => {
    expect(isValidJalaliRange({ start: d(1403, 1, 1), end: d(1403, 2, 1) })).toBe(true)
  })

  it('is false when incomplete or containing an invalid date', () => {
    expect(isValidJalaliRange({ start: d(1403, 1, 1), end: null })).toBe(false)
    expect(isValidJalaliRange({ start: d(1404, 12, 30), end: d(1404, 1, 1) })).toBe(false) // 1404 is not a leap year -- Esfand has 29 days
  })
})

describe('formatJalaliRange', () => {
  it('formats both ends with the given pattern', () => {
    expect(
      formatJalaliRange({ start: d(1403, 1, 1), end: d(1403, 1, 10) }, 'YYYY/MM/DD', {
        persianDigits: false,
      }),
    ).toBe('1403/01/01 – 1403/01/10')
  })

  it('uses the placeholder for a missing end', () => {
    expect(
      formatJalaliRange({ start: d(1403, 1, 1), end: null }, 'YYYY/MM/DD', {
        persianDigits: false,
      }),
    ).toBe('1403/01/01 – …')
  })

  it('honours a custom separator and placeholder', () => {
    expect(
      formatJalaliRange({ start: null, end: null }, 'YYYY/MM/DD', {
        separator: ' to ',
        placeholder: '?',
        persianDigits: false,
      }),
    ).toBe('? to ?')
  })
})

describe('jalaliMonthDays', () => {
  it('returns every day of the month in order', () => {
    const days = jalaliMonthDays(1403, 1)
    expect(days).toHaveLength(31)
    expect(days[0]).toEqual(d(1403, 1, 1))
    expect(days[30]).toEqual(d(1403, 1, 31))
  })

  it('respects leap-year Esfand length', () => {
    expect(jalaliMonthDays(1403, 12)).toHaveLength(30) // 1403 is a leap year
    expect(jalaliMonthDays(1404, 12)).toHaveLength(29)
  })
})
