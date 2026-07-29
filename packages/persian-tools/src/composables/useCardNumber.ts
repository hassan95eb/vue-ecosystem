import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { normalizeCardNumber } from '../internal/validation-core'

export interface UseCardNumberReturn {
  /** `true` when the current value is a valid 16-digit Iranian card number. */
  readonly isValid: ComputedRef<boolean>
  /** Clean 16-digit string with separators stripped, or `null` when invalid. */
  readonly normalized: ComputedRef<string | null>
}

/**
 * Reactive v-model wrapper around `normalizeCardNumber` -- a thin layer over
 * the pure function exported from `@vue-ecosystem/persian-tools/validation`.
 *
 * ```ts
 * const cardNumber = ref('')
 * const { isValid, normalized } = useCardNumber(cardNumber)
 * ```
 */
export function useCardNumber(source: MaybeRefOrGetter<string>): UseCardNumberReturn {
  const normalized = computed(() => normalizeCardNumber(String(toValue(source))))

  return {
    isValid: computed(() => normalized.value !== null),
    normalized,
  }
}
