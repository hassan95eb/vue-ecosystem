import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import { isValidNationalId } from '../internal/validation-core'
import { toEnglishDigits } from '../internal/digits'

export interface UseNationalIdOptions {
  /**
   * Also require the first three digits to be a real province-code prefix.
   * Default `false`, matching `isValidNationalId`.
   */
  readonly checkPrefix?: MaybeRefOrGetter<boolean>
}

export interface UseNationalIdReturn {
  /** `true` when the current value is a valid Iranian national ID. */
  readonly isValid: ComputedRef<boolean>
  /** The value with digits normalised to ASCII, or `null` when invalid. */
  readonly normalized: ComputedRef<string | null>
}

/**
 * Reactive v-model wrapper around `isValidNationalId` -- a thin layer over the
 * pure function exported from `@vue-ecosystem/persian-tools/validation`.
 *
 * ```ts
 * const nationalId = ref('')
 * const { isValid, normalized } = useNationalId(nationalId)
 * ```
 */
export function useNationalId(
  source: MaybeRefOrGetter<string>,
  options: UseNationalIdOptions = {},
): UseNationalIdReturn {
  const digits = computed(() => toEnglishDigits(String(toValue(source))).trim())
  const isValid = computed(() =>
    isValidNationalId(digits.value, { checkPrefix: toValue(options.checkPrefix) ?? false }),
  )

  return {
    isValid,
    normalized: computed(() => (isValid.value ? digits.value : null)),
  }
}
