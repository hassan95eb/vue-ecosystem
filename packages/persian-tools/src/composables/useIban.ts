import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { normalizeIban } from '../internal/validation-core'

export interface UseIbanReturn {
  /** `true` when the current value is a valid Iranian IBAN / Sheba number. */
  readonly isValid: ComputedRef<boolean>
  /** Canonical `IR` + 24-digit form, or `null` when invalid. */
  readonly normalized: ComputedRef<string | null>
}

/**
 * Reactive v-model wrapper around `normalizeIban` -- a thin layer over the
 * pure function exported from `@vue-ecosystem/persian-tools/validation`.
 *
 * ```ts
 * const iban = ref('')
 * const { isValid, normalized } = useIban(iban)
 * ```
 */
export function useIban(source: MaybeRefOrGetter<string>): UseIbanReturn {
  const normalized = computed(() => normalizeIban(String(toValue(source))))

  return {
    isValid: computed(() => normalized.value !== null),
    normalized,
  }
}
