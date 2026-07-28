import { describe, it, expect } from 'vitest'
import {
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
} from '../src/jalali'

describe('gregorianToJalali / jalaliToGregorian', () => {
  // Fixed historical anchors.
  const anchors = [
    { g: [2024, 3, 20], j: [1403, 1, 1], label: 'Nowruz 1403' },
    { g: [1979, 2, 11], j: [1357, 11, 22], label: '22 Bahman 1357' },
    { g: [1621, 3, 21], j: [1000, 1, 1], label: 'Nowruz 1000' },
  ] as const

  for (const { g, j, label } of anchors) {
    it(`maps ${label} in both directions`, () => {
      expect(gregorianToJalali(g[0], g[1], g[2])).toEqual({ jy: j[0], jm: j[1], jd: j[2] })
      expect(jalaliToGregorian(j[0], j[1], j[2])).toEqual({ gy: g[0], gm: g[1], gd: g[2] })
    })
  }

  it('round-trips every day across a 60-year span', () => {
    // 1 Farvardin 1370 .. ~1430, day by day.
    let cursor = { jy: 1370, jm: 1, jd: 1 }
    for (let i = 0; i < 60 * 366; i += 1) {
      const g = jalaliToGregorian(cursor.jy, cursor.jm, cursor.jd)
      expect(gregorianToJalali(g.gy, g.gm, g.gd)).toEqual(cursor)
      cursor = addJalaliDays(cursor, 1)
    }
  })
})

describe('agreement with Intl "persian" calendar', () => {
  // An independent implementation of the same calendar, shipped with the runtime.
  // If our arithmetic drifts, this fails loudly rather than silently.
  const fmt = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  })

  function fromIntl(date: Date): { jy: number; jm: number; jd: number } {
    const parts = fmt.formatToParts(date)
    const get = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value.replace(/[^\d-]/g, ''))
    return { jy: get('year'), jm: get('month'), jd: get('day') }
  }

  it('matches Intl for ~40 years of daily dates', () => {
    const start = Date.UTC(1990, 0, 1)
    const dayMs = 86_400_000
    for (let i = 0; i < 40 * 365; i += 1) {
      const date = new Date(start + i * dayMs)
      const ours = gregorianToJalali(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
      )
      expect({ date: date.toISOString().slice(0, 10), ...ours }).toEqual({
        date: date.toISOString().slice(0, 10),
        ...fromIntl(date),
      })
    }
  })
})

describe('leap years', () => {
  // The canonical modern sequence: mostly 4-year gaps, with a 5-year gap that a
  // naive `year % 4` rule gets wrong. That is the entire point of these cases.
  const leapYears = [1370, 1375, 1379, 1383, 1387, 1391, 1395, 1399, 1403, 1408]
  const commonYears = [1371, 1372, 1373, 1374, 1376, 1400, 1401, 1402, 1404, 1405, 1406, 1407]

  it.each(leapYears)('%i is a leap year', (jy: number) => {
    expect(isLeapJalaliYear(jy)).toBe(true)
    expect(jalaliMonthLength(jy, 12)).toBe(30)
    expect(isValidJalaliDate(jy, 12, 30)).toBe(true)
  })

  it.each(commonYears)('%i is a common year', (jy: number) => {
    expect(isLeapJalaliYear(jy)).toBe(false)
    expect(jalaliMonthLength(jy, 12)).toBe(29)
    expect(isValidJalaliDate(jy, 12, 30)).toBe(false)
  })

  it('breaks the naive "every 4 years" rule at 1403 -> 1408', () => {
    // 1407 would be leap under `jy % 4`, but the real gap here is five years.
    expect(isLeapJalaliYear(1403)).toBe(true)
    expect(isLeapJalaliYear(1407)).toBe(false)
    expect(isLeapJalaliYear(1408)).toBe(true)
  })

  it('gives leap years 366 days and common years 365', () => {
    expect(jalaliDayOfYear({ jy: 1403, jm: 12, jd: 30 })).toBe(366)
    expect(jalaliDayOfYear({ jy: 1404, jm: 12, jd: 29 })).toBe(365)
  })

  it('rolls 30 Esfand of a leap year into 1 Farvardin', () => {
    expect(addJalaliDays({ jy: 1403, jm: 12, jd: 30 }, 1)).toEqual({ jy: 1404, jm: 1, jd: 1 })
    expect(addJalaliDays({ jy: 1404, jm: 1, jd: 1 }, -1)).toEqual({ jy: 1403, jm: 12, jd: 30 })
  })

  it('rolls 29 Esfand of a common year into 1 Farvardin', () => {
    expect(addJalaliDays({ jy: 1404, jm: 12, jd: 29 }, 1)).toEqual({ jy: 1405, jm: 1, jd: 1 })
  })
})

describe('jalaliMonthLength', () => {
  it('gives 31 days to the first six months', () => {
    for (let m = 1; m <= 6; m += 1) expect(jalaliMonthLength(1403, m)).toBe(31)
  })

  it('gives 30 days to months 7-11', () => {
    for (let m = 7; m <= 11; m += 1) expect(jalaliMonthLength(1403, m)).toBe(30)
  })

  it('rejects an out-of-range month', () => {
    expect(() => jalaliMonthLength(1403, 13)).toThrowError()
    expect(() => jalaliMonthLength(1403, 0)).toThrowError()
  })
})

describe('isValidJalaliDate', () => {
  it.each([
    [1403, 1, 31, true],
    [1403, 7, 30, true],
    [1403, 7, 31, false],
    [1403, 12, 30, true],
    [1404, 12, 30, false],
    [1403, 0, 1, false],
    [1403, 13, 1, false],
    [1403, 1, 0, false],
    [1403.5, 1, 1, false],
    [9999, 1, 1, false],
  ])('(%i, %i, %i) -> %s', (jy: number, jm: number, jd: number, expected: boolean) => {
    expect(isValidJalaliDate(jy, jm, jd)).toBe(expected)
  })
})

describe('errors', () => {
  it('throws a tagged ecosystem error for an impossible date', () => {
    try {
      jalaliToGregorian(1404, 12, 30)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeEcosystemError('persian-tools/invalid-jalali-date')
    }
  })

  it('throws for a year outside the supported range', () => {
    expect(() => jalaliToGregorian(5000, 1, 1)).toThrowError()
    try {
      isLeapJalaliYear(-100)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeEcosystemError('persian-tools/year-out-of-range')
    }
  })
})

describe('Date interop', () => {
  it('reads a Date in local time', () => {
    expect(dateToJalali(new Date(2024, 2, 20))).toEqual({ jy: 1403, jm: 1, jd: 1 })
  })

  it('produces a Date at local midnight', () => {
    const date = jalaliToDate(1403, 1, 1)
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(20)
    expect(date.getHours()).toBe(0)
  })

  it('rejects an invalid Date', () => {
    expect(() => dateToJalali(new Date('nope'))).toThrowError()
  })
})

describe('addJalaliMonths', () => {
  it('clamps the day to the target month length', () => {
    // 31 Farvardin + 6 months -> Mehr has 30 days.
    expect(addJalaliMonths({ jy: 1403, jm: 1, jd: 31 }, 6)).toEqual({ jy: 1403, jm: 7, jd: 30 })
    // 31 Farvardin + 11 months -> Esfand of a common year has 29 days.
    expect(addJalaliMonths({ jy: 1404, jm: 1, jd: 31 }, 11)).toEqual({ jy: 1404, jm: 12, jd: 29 })
  })

  it('crosses year boundaries in both directions', () => {
    expect(addJalaliMonths({ jy: 1403, jm: 11, jd: 5 }, 3)).toEqual({ jy: 1404, jm: 2, jd: 5 })
    expect(addJalaliMonths({ jy: 1403, jm: 2, jd: 5 }, -3)).toEqual({ jy: 1402, jm: 11, jd: 5 })
  })
})

describe('jalaliDayOfWeek', () => {
  it('returns 0 for Saturday', () => {
    // 2024-03-23 was a Saturday = 4 Farvardin 1403.
    expect(jalaliDayOfWeek({ jy: 1403, jm: 1, jd: 4 })).toBe(0)
  })

  it('agrees with the underlying Gregorian weekday for a whole week', () => {
    for (let i = 0; i < 7; i += 1) {
      const parts = addJalaliDays({ jy: 1403, jm: 1, jd: 1 }, i)
      const g = jalaliToDate(parts.jy, parts.jm, parts.jd)
      expect(jalaliDayOfWeek(parts)).toBe((g.getDay() + 1) % 7)
    }
  })
})
