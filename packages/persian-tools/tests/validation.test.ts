import { describe, it, expect } from 'vitest'
import {
  isValidNationalId,
  isValidIban,
  normalizeIban,
  isValidCardNumber,
  normalizeCardNumber,
  isValidIranianMobile,
  normalizeIranianMobile,
} from '../src/validation'

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

describe('isValidIban / normalizeIban', () => {
  it('accepts a valid Sheba number with the IR prefix', () => {
    expect(isValidIban('IR820540102680020817909002')).toBe(true)
    expect(normalizeIban('IR820540102680020817909002')).toBe('IR820540102680020817909002')
  })

  it('accepts the same number without the IR prefix and adds it back', () => {
    expect(isValidIban('820540102680020817909002')).toBe(true)
    expect(normalizeIban('820540102680020817909002')).toBe('IR820540102680020817909002')
  })

  it('is case-insensitive on the prefix and tolerates spaces/dashes', () => {
    expect(isValidIban('ir82 0540 1026 8002 0817 909002')).toBe(true)
    expect(isValidIban('ir82-0540-1026-8002-0817-909002')).toBe(true)
  })

  it('handles Persian digits', () => {
    expect(isValidIban('IR۸۲۰۵۴۰۱۰۲۶۸۰۰۲۰۸۱۷۹۰۹۰۰۲')).toBe(true)
  })

  it('rejects a bad check-digit pair', () => {
    expect(isValidIban('IR820540102680020817909003')).toBe(false)
    expect(normalizeIban('IR820540102680020817909003')).toBeNull()
  })

  it.each([
    ['', 'empty'],
    ['IR123', 'too short'],
    ['IR82054010268002081790900299', 'too long'],
  ])('rejects %s (%s)', (input: string) => {
    expect(isValidIban(input)).toBe(false)
  })
})

describe('isValidCardNumber / normalizeCardNumber', () => {
  it.each(['6219861034529007', '5022291070873466'])('accepts %s', (card: string) => {
    expect(isValidCardNumber(card)).toBe(true)
    expect(normalizeCardNumber(card)).toBe(card)
  })

  it('accepts a card number written with separators and Persian digits', () => {
    expect(isValidCardNumber('6219 8610 3452 9007')).toBe(true)
    expect(isValidCardNumber('6219-8610-3452-9007')).toBe(true)
    expect(isValidCardNumber('۶۲۱۹۸۶۱۰۳۴۵۲۹۰۰۷')).toBe(true)
    expect(normalizeCardNumber('6219 8610 3452 9007')).toBe('6219861034529007')
  })

  it('rejects a wrong check digit', () => {
    expect(isValidCardNumber('6219861034529008')).toBe(false)
  })

  it.each([
    ['', 'empty'],
    ['621986103452900', 'too short (15 digits)'],
    ['6219861034529007123', '19 digits (would pass if only the first 16 were checked)'],
    ['621986103452900a', 'non-numeric'],
  ])('rejects %s (%s)', (input: string) => {
    expect(isValidCardNumber(input)).toBe(false)
    expect(normalizeCardNumber(input)).toBeNull()
  })
})
