import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import {
  formatCurrency,
  formatNumber,
  parsePersianNumber,
  type Currency,
  type FormatNumberOptions,
} from '../internal/number-core'
import { toEnglishDigits, toPersianDigits } from '../internal/digits'

export interface UsePersianNumberOptions extends FormatNumberOptions {
  /** Append a currency unit to `currency`. Default `'toman'`. */
  readonly currency?: MaybeRefOrGetter<Currency>
}

export interface UsePersianNumberReturn {
  /** Grouped, Persian-digit representation. */
  readonly formatted: ComputedRef<string>
  /** Same value with a currency unit appended. */
  readonly currency: ComputedRef<string>
  /** The value as an ASCII-digit string, no grouping. */
  readonly english: ComputedRef<string>
  /** The value as Persian digits, no grouping. */
  readonly persian: ComputedRef<string>
  /** The numeric value, or `NaN` if the input could not be parsed. */
  readonly value: ComputedRef<number>
}

/**
 * Reactive Persian number formatting -- a thin wrapper over the pure functions in
 * `@vue-ecosystem/persian-tools/number`.
 */
export function usePersianNumber(
  source: MaybeRefOrGetter<number | string>,
  options: UsePersianNumberOptions = {},
): UsePersianNumberReturn {
  const raw = computed(() => toValue(source))
  const numeric = computed(() => {
    const value = raw.value
    return typeof value === 'number' ? value : parsePersianNumber(value)
  })

  const formatOptions = computed<FormatNumberOptions>(() => ({
    persianDigits: options.persianDigits ?? true,
    ...(options.thousandsSeparator === undefined
      ? {}
      : { thousandsSeparator: options.thousandsSeparator }),
    ...(options.decimalSeparator === undefined
      ? {}
      : { decimalSeparator: options.decimalSeparator }),
    ...(options.decimals === undefined ? {} : { decimals: options.decimals }),
  }))

  return {
    formatted: computed(() => formatNumber(numeric.value, formatOptions.value)),
    currency: computed(() =>
      formatCurrency(numeric.value, toValue(options.currency) ?? 'toman', formatOptions.value),
    ),
    english: computed(() => toEnglishDigits(String(raw.value))),
    persian: computed(() => toPersianDigits(String(raw.value))),
    value: numeric,
  }
}
