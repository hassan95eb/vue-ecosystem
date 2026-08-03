// Public API surface. No logic here by design -- the exports map and the
// `internal/` boundary lint rule both point at exactly this file.

export { useVirtualList } from './composables/useVirtualList'
export type {
  UseVirtualListOptions,
  UseVirtualListReturn,
  VirtualItem,
} from './composables/useVirtualList'

// The windowing math is exported too: it is pure, framework-agnostic and useful
// to anyone building their own renderer on top of it (`smart-table` included).
export {
  computeVirtualRange,
  computeTotalHeight,
  offsetForIndex,
  DEFAULT_OVERSCAN,
} from './internal/virtual-core'
export type { VirtualRange, VirtualRangeInput } from './internal/virtual-core'

export { VirtualScrollError } from './internal/errors'
