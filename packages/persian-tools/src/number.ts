// Public entry for the framework-agnostic number layer.

export { toPersianDigits, toEnglishDigits, hasNonAsciiDigits } from './internal/digits'
export {
  formatNumber,
  parsePersianNumber,
  formatCurrency,
  rialToToman,
  tomanToRial,
  PERSIAN_THOUSANDS_SEPARATOR,
  PERSIAN_DECIMAL_SEPARATOR,
} from './internal/number-core'
export type { FormatNumberOptions, FormatCurrencyOptions, Currency } from './internal/number-core'
