// Public API surface. No logic here by design -- the exports map and the
// `internal/` boundary lint rule both point at exactly this file.

// --- Framework-agnostic layer (re-exported for convenience; also available as
// --- the `/jalali`, `/number` and `/validation` subpaths without touching Vue).
export * from './jalali'
export * from './number'
export * from './validation'

// --- Vue layer -------------------------------------------------------------
export { useJalali } from './composables/useJalali'
export type { JalaliInput, UseJalaliOptions, UseJalaliReturn } from './composables/useJalali'

export { usePersianNumber } from './composables/usePersianNumber'
export type {
  UsePersianNumberOptions,
  UsePersianNumberReturn,
} from './composables/usePersianNumber'

export { useNationalId } from './composables/useNationalId'
export type { UseNationalIdOptions, UseNationalIdReturn } from './composables/useNationalId'

export { useIban } from './composables/useIban'
export type { UseIbanReturn } from './composables/useIban'

export { useCardNumber } from './composables/useCardNumber'
export type { UseCardNumberReturn } from './composables/useCardNumber'

export { useDateRangePicker } from './composables/useDateRangePicker'
export type {
  UseDateRangePickerOptions,
  UseDateRangePickerReturn,
} from './composables/useDateRangePicker'
export type { JalaliRange } from './internal/jalali-range'

export { vRtlInput, RTL_INPUT_DIRECTIVE_NAME } from './directives/vRtlInput'
export type { RtlInputOptions } from './directives/vRtlInput'

export { vPersianDigits, PERSIAN_DIGITS_DIRECTIVE_NAME } from './directives/vPersianDigits'
export type { PersianDigitsOptions } from './directives/vPersianDigits'

export { vHalfSpace, HALF_SPACE_DIRECTIVE_NAME } from './directives/vHalfSpace'

export { default as PersianDateRangePicker } from './components/PersianDateRangePicker.vue'
export type { PersianDateRangePickerProps } from './components/PersianDateRangePicker.vue'

export { default as HolidayBadge } from './components/HolidayBadge.vue'
export type { HolidayBadgeProps } from './components/HolidayBadge.vue'

export { default as RelativeDate } from './components/RelativeDate.vue'
export type { RelativeDateProps } from './components/RelativeDate.vue'

export { PersianToolsError } from './internal/errors'
