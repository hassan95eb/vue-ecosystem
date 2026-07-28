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

export { vRtlInput, RTL_INPUT_DIRECTIVE_NAME } from './directives/vRtlInput'
export type { RtlInputOptions } from './directives/vRtlInput'

export { PersianToolsError } from './internal/errors'
