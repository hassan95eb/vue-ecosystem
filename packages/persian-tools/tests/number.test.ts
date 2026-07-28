import { describe, it, expect } from 'vitest'
import {
  toPersianDigits,
  toEnglishDigits,
  hasNonAsciiDigits,
  formatNumber,
  parsePersianNumber,
  formatCurrency,
  rialToToman,
  tomanToRial,
} from '../src/number'

describe('digit conversion', () => {
  it('converts ASCII to Persian', () => {
    expect(toPersianDigits('0123456789')).toBe('۰۱۲۳۴۵۶۷۸۹')
    expect(toPersianDigits(42)).toBe('۴۲')
  })

  it('converts Persian and Arabic-Indic digits to ASCII', () => {
    expect(toEnglishDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789')
    expect(toEnglishDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
  })

  it('leaves non-digit characters alone', () => {
    expect(toPersianDigits('کد ۲ / code 2')).toBe('کد ۲ / code ۲')
    expect(toEnglishDigits('تلفن: ۰۲۱-۱۲۳')).toBe('تلفن: 021-123')
  })

  it('round-trips', () => {
    expect(toEnglishDigits(toPersianDigits('9876543210'))).toBe('9876543210')
  })

  it('detects non-ASCII digits', () => {
    expect(hasNonAsciiDigits('۱۲۳')).toBe(true)
    expect(hasNonAsciiDigits('١٢٣')).toBe(true)
    expect(hasNonAsciiDigits('123')).toBe(false)
    expect(hasNonAsciiDigits('سلام')).toBe(false)
  })
})

describe('formatNumber', () => {
  it('groups thousands with Persian digits by default', () => {
    expect(formatNumber(1234567)).toBe('۱٬۲۳۴٬۵۶۷')
  })

  it('groups with ASCII digits and a comma when asked', () => {
    expect(formatNumber(1234567, { persianDigits: false })).toBe('1,234,567')
  })

  it.each([
    [0, '۰'],
    [1, '۱'],
    [999, '۹۹۹'],
    [1000, '۱٬۰۰۰'],
    [-1234567, '-۱٬۲۳۴٬۵۶۷'],
  ])('formats %i', (input: number, expected: string) => {
    expect(formatNumber(input)).toBe(expected)
  })

  it('applies a fixed decimal count', () => {
    expect(formatNumber(1234.5, { decimals: 2, persianDigits: false })).toBe('1,234.50')
    expect(formatNumber(1234.5, { decimals: 2 })).toBe('۱٬۲۳۴٫۵۰')
  })

  it('honours custom separators', () => {
    expect(formatNumber(1234567, { persianDigits: false, thousandsSeparator: ' ' })).toBe(
      '1 234 567',
    )
    expect(formatNumber(1234567, { persianDigits: false, thousandsSeparator: '' })).toBe('1234567')
  })

  it('accepts a Persian-digit string as input', () => {
    expect(formatNumber('۱۲۳۴۵۶۷', { persianDigits: false })).toBe('1,234,567')
  })

  it('returns an empty string for non-numeric input', () => {
    expect(formatNumber('abc')).toBe('')
    expect(formatNumber(Number.NaN)).toBe('')
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('')
  })
})

describe('parsePersianNumber', () => {
  it('reverses formatNumber', () => {
    expect(parsePersianNumber(formatNumber(1234567))).toBe(1234567)
    expect(parsePersianNumber(formatNumber(1234.56, { decimals: 2 }))).toBeCloseTo(1234.56)
  })

  it('accepts ASCII grouping and whitespace', () => {
    expect(parsePersianNumber('1,234,567')).toBe(1234567)
    expect(parsePersianNumber(' ۱۲۳ ')).toBe(123)
  })

  it('returns NaN for unparseable input', () => {
    expect(parsePersianNumber('')).toBeNaN()
    expect(parsePersianNumber('سلام')).toBeNaN()
  })
})

describe('formatCurrency', () => {
  it('defaults to toman', () => {
    expect(formatCurrency(1234567)).toBe('۱٬۲۳۴٬۵۶۷ تومان')
  })

  it('formats rial', () => {
    expect(formatCurrency(1234567, 'rial')).toBe('۱٬۲۳۴٬۵۶۷ ریال')
  })

  it('can omit the unit', () => {
    expect(formatCurrency(1000, 'toman', { showUnit: false })).toBe('۱٬۰۰۰')
  })

  it('returns an empty string for non-numeric input', () => {
    expect(formatCurrency('abc')).toBe('')
  })

  it('converts between rial and toman', () => {
    expect(rialToToman(10_000)).toBe(1000)
    expect(tomanToRial(1000)).toBe(10_000)
  })
})
