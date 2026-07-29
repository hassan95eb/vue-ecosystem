/**
 * Iranian national-ID, IBAN (Sheba), card-number and mobile-number validation.
 * Pure, no Vue.
 *
 * National-ID, IBAN and card-number checksum/format logic is delegated to
 * `@persian-tools/persian-tools` rather than hand-rolled -- see the "finalized
 * scope" decision in the persian-tools MVP-completion task: this package's own
 * code stays limited to Jalali date logic and the date-range picker, not
 * checksum reimplementations the upstream library already covers.
 *
 * `isValidIranianMobile` / `normalizeIranianMobile` below are the one
 * exception: `@persian-tools/persian-tools` has no mobile-number validator, so
 * that pair is ecosystem-added and intentionally NOT delegated.
 */
import {
  verifyIranianNationalId,
  isValidNationalIdFormat,
  isShebaValid,
  verifyCardNumber,
} from '@persian-tools/persian-tools'
import { toEnglishDigits } from './digits'

export interface IsValidNationalIdOptions {
  /**
   * Also require the first three digits to be a real province-code prefix.
   * Default `false`.
   *
   * The previous hand-rolled implementation never checked this, and the
   * default here preserves that: enabling it would silently reject
   * checksum-valid IDs that passed before this package wrapped the library.
   * See the task report for this default as a flagged judgment call.
   */
  readonly checkPrefix?: boolean
}

/**
 * Validates an Iranian national identification number (کد ملی).
 *
 * Delegates the checksum and the not-all-identical-digits rule to
 * `@persian-tools/persian-tools`'s `verifyIranianNationalId`. The exact-10-digit
 * format gate is applied here first (via the library's own
 * `isValidNationalIdFormat`) because `verifyIranianNationalId` left-pads short
 * input with zeros -- e.g. `'84575948'` would silently become `'0084575948'`
 * and pass. That auto-padding is convenient for a free-text input field but
 * wrong for a validator, where a caller expects leading zeros to be
 * significant and a truncated ID to be rejected, not repaired.
 *
 * Leading zeros are significant, so the input is a string.
 */
export function isValidNationalId(input: string, options: IsValidNationalIdOptions = {}): boolean {
  const digits = toEnglishDigits(String(input)).trim()
  if (!isValidNationalIdFormat(digits)) return false
  return verifyIranianNationalId(digits, { checkPrefix: options.checkPrefix ?? false })
}

/**
 * Validates an Iranian IBAN / Sheba number (شماره شبا).
 * Accepts the number with or without the `IR` prefix, with or without spaces.
 */
export function isValidIban(input: string): boolean {
  return normalizeIban(input) !== null
}

/**
 * Normalises an Iranian IBAN / Sheba number to its canonical `IR` + 24-digit
 * form (e.g. `IR820540102680020817909002`). Returns `null` when invalid.
 */
export function normalizeIban(input: string): string | null {
  const cleaned = toEnglishDigits(String(input)).replace(/[\s-]/g, '').toUpperCase()
  const candidate = cleaned.startsWith('IR') ? cleaned : `IR${cleaned}`
  return isShebaValid(candidate) ? candidate : null
}

const CARD_NUMBER_RE = /^\d{16}$/

/**
 * Validates an Iranian bank card number (16 digits) via the Luhn-derived
 * checksum used by Iranian banks.
 */
export function isValidCardNumber(input: string): boolean {
  return normalizeCardNumber(input) !== null
}

/**
 * Normalises a card number to a clean 16-digit string. Returns `null` when
 * invalid.
 *
 * The exact-16-digit gate is applied here rather than left to the library:
 * `verifyCardNumber` only loops over the first 16 characters of its input, so
 * a 19-digit string whose first 16 digits happen to checksum correctly would
 * otherwise pass.
 *
 * The upstream type signature is `verifyCardNumber(digits: number)`, but a
 * 16-digit card number regularly exceeds `Number.MAX_SAFE_INTEGER` (2^53), so
 * passing it as a JS `number` risks silent precision loss and a wrong
 * checksum. The implementation only ever does `String(digits)` internally, so
 * the string is passed straight through instead of being coerced to `number`.
 */
export function normalizeCardNumber(input: string): string | null {
  const digits = toEnglishDigits(String(input)).replace(/[\s-]/g, '')
  if (!CARD_NUMBER_RE.test(digits)) return null
  return verifyCardNumber(digits as unknown as number) === true ? digits : null
}

const MOBILE_RE = /^(?:\+98|0098|98|0)?(9\d{9})$/

/**
 * Normalises an Iranian mobile number to national `09xxxxxxxxx` form.
 * Accepts `+98…`, `0098…`, `98…`, `09…` and bare `9…`, with spaces or dashes.
 * Returns `null` when the input is not a valid Iranian mobile number.
 *
 * Ecosystem-added: `@persian-tools/persian-tools` has no mobile-number
 * validator, so this pair (along with `isValidIranianMobile`) is
 * hand-rolled rather than delegated -- unlike national-ID, IBAN and
 * card-number above.
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
