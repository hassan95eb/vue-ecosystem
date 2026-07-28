/** Iranian national-ID and mobile-number validation. Pure, no Vue. */
import { toEnglishDigits } from './digits'

/**
 * Validates an Iranian national identification number (کد ملی).
 *
 * Rules: exactly 10 digits, not all-identical (`0000000000`, `1111111111` … pass
 * the checksum but are not issued), and a mod-11 check digit.
 * Leading zeros are significant, so the input is a string.
 */
export function isValidNationalId(input: string): boolean {
  const digits = toEnglishDigits(String(input)).trim()
  if (!/^\d{10}$/.test(digits)) return false
  if (/^(\d)\1{9}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    sum += Number(digits[i]) * (10 - i)
  }
  const remainder = sum % 11
  const check = Number(digits[9])

  return remainder < 2 ? check === remainder : check === 11 - remainder
}

const MOBILE_RE = /^(?:\+98|0098|98|0)?(9\d{9})$/

/**
 * Normalises an Iranian mobile number to national `09xxxxxxxxx` form.
 * Accepts `+98…`, `0098…`, `98…`, `09…` and bare `9…`, with spaces or dashes.
 * Returns `null` when the input is not a valid Iranian mobile number.
 */
export function normalizeIranianMobile(input: string): string | null {
  const cleaned = toEnglishDigits(String(input)).replace(/[\s\-().]/g, '')
  const match = MOBILE_RE.exec(cleaned)
  return match?.[1] === undefined ? null : `0${match[1]}`
}

/** True when the input is a valid Iranian mobile number in any accepted form. */
export function isValidIranianMobile(input: string): boolean {
  return normalizeIranianMobile(input) !== null
}
