/** Persian number and currency formatting. Pure, no Vue. */
import { toEnglishDigits, toPersianDigits } from './digits'

/** U+066C ARABIC THOUSANDS SEPARATOR -- the correct grouping mark in Persian text. */
export const PERSIAN_THOUSANDS_SEPARATOR = '٬'
/** U+066B ARABIC DECIMAL SEPARATOR. */
export const PERSIAN_DECIMAL_SEPARATOR = '٫'

export interface FormatNumberOptions {
  /** Emit Persian digits instead of ASCII. Default `true`. */
  readonly persianDigits?: boolean
  /** Thousands separator. Defaults to `٬` for Persian digits, `,` for ASCII. */
  readonly thousandsSeparator?: string
  /** Decimal separator. Defaults to `٫` for Persian digits, `.` for ASCII. */
  readonly decimalSeparator?: string
  /** Fixed number of decimal places. Omit to keep the value's own precision. */
  readonly decimals?: number
}

function groupThousands(digits: string, separator: string): string {
  if (separator === '') return digits
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}

/**
 * Formats a number with thousands grouping and, by default, Persian digits.
 *
 * ```ts
 * formatNumber(1234567.5, { decimals: 2 }) // '۱٬۲۳۴٬۵۶۷٫۵۰'
 * formatNumber(1234567, { persianDigits: false }) // '1,234,567'
 * ```
 */
export function formatNumber(value: number | string, options: FormatNumberOptions = {}): string {
  const persianDigits = options.persianDigits ?? true
  const thousandsSeparator =
    options.thousandsSeparator ?? (persianDigits ? PERSIAN_THOUSANDS_SEPARATOR : ',')
  const decimalSeparator =
    options.decimalSeparator ?? (persianDigits ? PERSIAN_DECIMAL_SEPARATOR : '.')

  const numeric = typeof value === 'number' ? value : Number(toEnglishDigits(value).trim())
  if (!Number.isFinite(numeric)) return ''

  const fixed = options.decimals === undefined ? String(numeric) : numeric.toFixed(options.decimals)
  const negative = fixed.startsWith('-')
  const [intPart = '0', fracPart] = (negative ? fixed.slice(1) : fixed).split('.')

  let out = groupThousands(intPart, thousandsSeparator)
  if (fracPart !== undefined && fracPart.length > 0) out += decimalSeparator + fracPart
  if (negative) out = `-${out}`

  return persianDigits ? toPersianDigits(out) : out
}

/** Removes grouping marks and normalises digits, giving a parseable ASCII string. */
export function parsePersianNumber(input: string): number {
  const normalised = toEnglishDigits(input)
    .replace(new RegExp(`[${PERSIAN_THOUSANDS_SEPARATOR},\\s]`, 'g'), '')
    .replace(PERSIAN_DECIMAL_SEPARATOR, '.')
  if (normalised.trim() === '') return Number.NaN
  return Number(normalised)
}

export type Currency = 'toman' | 'rial'

export interface FormatCurrencyOptions extends FormatNumberOptions {
  /** Append the unit name (`تومان` / `ریال`). Default `true`. */
  readonly showUnit?: boolean
}

const UNIT_LABEL: Record<Currency, string> = { toman: 'تومان', rial: 'ریال' }

/** `formatCurrency(1234567)` -> `'۱٬۲۳۴٬۵۶۷ تومان'` */
export function formatCurrency(
  value: number | string,
  currency: Currency = 'toman',
  options: FormatCurrencyOptions = {},
): string {
  const formatted = formatNumber(value, options)
  if (formatted === '') return ''
  return (options.showUnit ?? true) ? `${formatted} ${UNIT_LABEL[currency]}` : formatted
}

/** 1 toman = 10 rial. */
export const rialToToman = (rial: number): number => rial / 10
/** 1 toman = 10 rial. */
export const tomanToRial = (toman: number): number => toman * 10
