import { describe, it, expect } from 'vitest'
import { isValidNationalId, isValidIranianMobile, normalizeIranianMobile } from '../src/validation'

describe('isValidNationalId', () => {
  it.each(['0499370899', '0790419904', '0084575948', '1234567891'])('accepts %s', (id: string) => {
    expect(isValidNationalId(id)).toBe(true)
  })

  it('accepts a valid id written with Persian digits', () => {
    expect(isValidNationalId('۰۴۹۹۳۷۰۸۹۹')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(isValidNationalId('0499370898')).toBe(false)
  })

  it.each([
    ['', 'empty'],
    ['123', 'too short'],
    ['04993708991', 'too long'],
    ['04993708a9', 'non-numeric'],
  ])('rejects %s (%s)', (id: string) => {
    expect(isValidNationalId(id)).toBe(false)
  })

  it('rejects repeated-digit ids that would otherwise pass the checksum', () => {
    for (let d = 0; d <= 9; d += 1) {
      expect(isValidNationalId(String(d).repeat(10))).toBe(false)
    }
  })

  it('preserves leading zeros (string input, not number)', () => {
    expect(isValidNationalId('0084575948')).toBe(true)
    expect(isValidNationalId('84575948')).toBe(false)
  })
})

describe('normalizeIranianMobile', () => {
  it.each([
    '09123456789',
    '+989123456789',
    '00989123456789',
    '989123456789',
    '9123456789',
    '0912 345 6789',
    '0912-345-6789',
  ])('normalises %s to 09123456789', (input: string) => {
    expect(normalizeIranianMobile(input)).toBe('09123456789')
  })

  it('handles Persian digits', () => {
    expect(normalizeIranianMobile('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
  })

  it.each([
    ['', 'empty'],
    ['0812345678', 'not a mobile prefix'],
    ['091234567', 'too short'],
    ['091234567890', 'too long'],
    ['+449123456789', 'wrong country code'],
    ['09a23456789', 'non-numeric'],
  ])('returns null for %s (%s)', (input: string) => {
    expect(normalizeIranianMobile(input)).toBeNull()
  })
})

describe('isValidIranianMobile', () => {
  it('mirrors normalizeIranianMobile', () => {
    expect(isValidIranianMobile('+989123456789')).toBe(true)
    expect(isValidIranianMobile('0212345678')).toBe(false)
  })
})
