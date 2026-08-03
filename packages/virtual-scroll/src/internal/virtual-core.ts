/**
 * Pure windowing math for fixed-height rows.
 *
 * No Vue import lives in this file by design. The composable in
 * `../composables/useVirtualList.ts` is the DOM/reactive glue on top; everything
 * that can be decided from four numbers is decided here, so it can be tested
 * exhaustively without mounting a component. This mirrors the
 * pure-core / composable-wrapper split established by `persian-tools`
 * (`internal/jalali-core.ts`) -- see CONTRIBUTING.md, "Framework-agnostic core".
 */

import { invalidItemHeight, invalidOverscan } from './errors'

/**
 * Rows rendered beyond each edge of the viewport.
 *
 * 4 is a deliberate middle of the useful range. The buffer only has to cover
 * the rows a user can reveal between a scroll event firing and the next paint;
 * beyond that it is pure waste. At 4 a fast flick still has a frame or two of
 * already-mounted rows before it reaches blank space, and the cost is a flat
 * 8 extra rows of DOM no matter how long the list is -- it does not scale with
 * `itemCount`, which is the whole point of virtualising.
 */
export const DEFAULT_OVERSCAN = 4

export interface VirtualRangeInput {
  /** Current scroll offset of the container, in pixels. */
  readonly scrollTop: number
  /** Visible height of the scroll container, in pixels. */
  readonly containerHeight: number
  /** Fixed height of every row, in pixels. Must be finite and > 0. */
  readonly itemHeight: number
  /** Total number of items in the list. */
  readonly itemCount: number
  /** Rows rendered beyond each edge of the viewport. Defaults to {@link DEFAULT_OVERSCAN}. */
  readonly overscan?: number
}

export interface VirtualRange {
  /** First index to render, inclusive. Always within `[0, itemCount]`. */
  readonly startIndex: number
  /**
   * One past the last index to render -- **exclusive**, so `items.slice(startIndex, endIndex)`
   * is the rendered window and an empty window is simply `startIndex === endIndex`.
   * An inclusive end would need `-1` to mean "nothing", which is exactly the kind
   * of sentinel that produces off-by-one bugs in consumers.
   */
  readonly endIndex: number
  /** Pixel offset of `startIndex` from the top of the list -- the spacer above the window. */
  readonly startOffset: number
  /** Height of the whole list, for the spacer that keeps scrollbar proportions honest. */
  readonly totalHeight: number
}

/** Pixel offset of a row from the top of the list. */
export function offsetForIndex(index: number, itemHeight: number): number {
  return index * itemHeight
}

/** Scrollable height of the full list. */
export function computeTotalHeight(itemCount: number, itemHeight: number): number {
  return normaliseCount(itemCount) * itemHeight
}

function normaliseCount(itemCount: number): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 0
  return Math.floor(itemCount)
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Validate the two numeric options up front.
 *
 * Exported so the composable can fail at the call site rather than lazily, the
 * first time a `computed` happens to be read -- by then the stack trace no
 * longer points at the line that passed the bad value.
 *
 * @throws {@link VirtualScrollError} `virtual-scroll/invalid-item-height` or
 * `virtual-scroll/invalid-overscan`.
 */
export function assertValidWindowOptions(itemHeight: number, overscan: number): void {
  if (!Number.isFinite(itemHeight) || itemHeight <= 0) throw invalidItemHeight(itemHeight)
  if (!Number.isInteger(overscan) || overscan < 0) throw invalidOverscan(overscan)
}

/**
 * Compute the window of rows to render for a given scroll position.
 *
 * ```ts
 * computeVirtualRange({ scrollTop: 0, containerHeight: 100, itemHeight: 20, itemCount: 1000 })
 * // -> { startIndex: 0, endIndex: 9, startOffset: 0, totalHeight: 20000 }
 * //    5 visible rows + 4 of overscan below; overscan above is clamped away at index 0.
 * ```
 *
 * Validation lives here rather than in the composable so that both entry points
 * share one definition of "valid input" and it is testable without a DOM.
 *
 * @throws {@link VirtualScrollError} `virtual-scroll/invalid-item-height` when
 * `itemHeight` is not a finite number greater than 0, or
 * `virtual-scroll/invalid-overscan` when `overscan` is not a non-negative integer.
 */
export function computeVirtualRange(input: VirtualRangeInput): VirtualRange {
  const { scrollTop, containerHeight, itemHeight } = input
  const overscan = input.overscan ?? DEFAULT_OVERSCAN

  assertValidWindowOptions(itemHeight, overscan)

  const itemCount = normaliseCount(input.itemCount)
  const totalHeight = itemCount * itemHeight

  if (itemCount === 0) {
    return { startIndex: 0, endIndex: 0, startOffset: 0, totalHeight: 0 }
  }

  // A container that has not been measured yet (or is display:none) reports 0.
  const viewport = Number.isFinite(containerHeight) ? Math.max(0, containerHeight) : 0

  // Clamp rather than trust the input: a negative scrollTop is real (iOS
  // rubber-banding), and a scrollTop past the end happens whenever the list
  // shrinks while the user is scrolled down. Clamping to the last full screen
  // means both cases render the nearest real window instead of nothing --
  // an empty window here would show up as a blank list.
  const maxScrollTop = Math.max(0, totalHeight - viewport)
  const offset = Number.isFinite(scrollTop) ? clamp(scrollTop, 0, maxScrollTop) : 0

  const firstVisible = Math.floor(offset / itemHeight)
  const lastVisibleExclusive = Math.ceil((offset + viewport) / itemHeight)

  // Clamped at both boundaries, so the window never contains a negative index
  // and never runs past the end of the list.
  const startIndex = clamp(firstVisible - overscan, 0, itemCount)
  const endIndex = clamp(lastVisibleExclusive + overscan, startIndex, itemCount)

  return {
    startIndex,
    endIndex,
    startOffset: offsetForIndex(startIndex, itemHeight),
    totalHeight,
  }
}
