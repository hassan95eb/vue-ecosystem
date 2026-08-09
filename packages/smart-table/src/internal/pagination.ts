/**
 * Pagination. Pure index arithmetic, kept separate mainly so the off-by-one
 * cases have somewhere to be tested without a component.
 *
 * `pageIndex` is 0-based throughout, including in the public API. A 1-based
 * index that has to be translated at the render boundary is a permanent source
 * of off-by-one bugs; the label a user sees is `pageIndex + 1` and that
 * conversion belongs in the one place that renders it.
 */

import { invalidPageSize } from './errors'

export const DEFAULT_PAGE_SIZE = 25

/** @throws {@link SmartTableError} `smart-table/invalid-page-size` */
export function assertValidPageSize(pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw invalidPageSize(pageSize)
  }
}

/**
 * Number of pages. **Always at least 1**, even for zero rows.
 *
 * An empty table is on page 1 of 1 showing nothing, not on page 1 of 0. The
 * latter makes every `pageIndex < pageCount` guard false and leaves the
 * pagination controls in an unreachable state.
 */
export function pageCountFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Clamp into `[0, pageCount - 1]`. Non-integers and `NaN` collapse to 0. */
export function clampPageIndex(pageIndex: number, pageCount: number): number {
  if (!Number.isFinite(pageIndex)) return 0
  return Math.min(Math.max(Math.trunc(pageIndex), 0), Math.max(pageCount - 1, 0))
}

/** The slice for one page. `rows` is not mutated. */
export function paginateRows<T>(rows: readonly T[], pageIndex: number, pageSize: number): T[] {
  const start = pageIndex * pageSize
  return rows.slice(start, start + pageSize)
}
