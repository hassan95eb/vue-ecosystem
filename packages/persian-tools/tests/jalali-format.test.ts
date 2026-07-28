import { describe, it, expect } from 'vitest'
import { formatJalali, parseJalali, JALALI_MONTH_NAMES } from '../src/jalali'

const NOWRUZ = { jy: 1403, jm: 1, jd: 1 }

describe('formatJalali', () => {
  it('uses YYYY/MM/DD with Persian digits by default', () => {
    expect(formatJalali(NOWRUZ)).toBe('۱۴۰۳/۰۱/۰۱')
  })

  it('emits ASCII digits when asked', () => {
    expect(formatJalali(NOWRUZ, 'YYYY/MM/DD', { persianDigits: false })).toBe('1403/01/01')
  })

  it.each([
    ['YYYY', '1403'],
    ['YY', '03'],
    ['MMMM', 'فروردین'],
    ['MM', '01'],
    ['M', '1'],
    ['DD', '01'],
    ['D', '1'],
    ['dddd', 'چهارشنبه'],
  ])('resolves %s', (pattern: string, expected: string) => {
    expect(formatJalali(NOWRUZ, pattern, { persianDigits: false })).toBe(expected)
  })

  it('formats a long human-readable date', () => {
    expect(formatJalali({ jy: 1403, jm: 7, jd: 15 }, 'D MMMM YYYY')).toBe('۱۵ مهر ۱۴۰۳')
  })

  it('emits bracketed text literally', () => {
    expect(formatJalali(NOWRUZ, '[سال] YYYY', { persianDigits: false })).toBe('سال 1403')
  })

  it('names all twelve months', () => {
    expect(JALALI_MONTH_NAMES).toHaveLength(12)
    for (let m = 1; m <= 12; m += 1) {
      expect(formatJalali({ jy: 1403, jm: m, jd: 1 }, 'MMMM')).toBe(JALALI_MONTH_NAMES[m - 1])
    }
  })
})

describe('parseJalali', () => {
  it.each([
    ['1403/01/01', { jy: 1403, jm: 1, jd: 1 }],
    ['1403-1-1', { jy: 1403, jm: 1, jd: 1 }],
    ['1403.12.29', { jy: 1403, jm: 12, jd: 29 }],
    ['۱۴۰۳/۰۷/۱۵', { jy: 1403, jm: 7, jd: 15 }],
    ['  1403/07/15  ', { jy: 1403, jm: 7, jd: 15 }],
  ])('parses %s', (input: string, expected: { jy: number; jm: number; jd: number }) => {
    expect(parseJalali(input)).toEqual(expected)
  })

  it.each(['', 'not a date', '1403/01', '1403/01/01/01', '14030101'])(
    'returns null for %s',
    (input: string) => {
      expect(parseJalali(input)).toBeNull()
    },
  )

  it('parses shape only, leaving validity to isValidJalaliDate', () => {
    expect(parseJalali('1404/12/30')).toEqual({ jy: 1404, jm: 12, jd: 30 })
  })
})
