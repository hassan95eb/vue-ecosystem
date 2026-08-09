/**
 * The whole table, as one pure function.
 *
 * ## Why the order is filter -> sort -> paginate, and cannot be anything else
 *
 * - Sorting before filtering is wasted work: it orders rows that are about to
 *   be discarded.
 * - Paginating before sorting sorts *within a page*, which produces a table
 *   where page 2 starts over at "A" -- a bug that looks like a rendering glitch
 *   and is actually a pipeline-order mistake.
 * - The page index is clamped **after** filtering, because filtering is what
 *   changes the page count. Typing into the search box while on page 9 must
 *   land you on the last page that now exists, not on an empty one.
 *
 * Keeping the whole pipeline here, rather than as four chained `computed`s in
 * the composable, is what makes those three rules testable in a node
 * environment with no Vue in sight -- and what keeps the composable a wiring
 * layer with no decisions in it.
 */

import type { QueryAst } from '@vue-ecosystem/query-builder'
import type { ColumnDef } from './columns'
import { filterRows } from './filter'
import { clampPageIndex, pageCountFor, paginateRows } from './pagination'
import { sortRows, type SortRule } from './sort'

export interface TableState {
  readonly sort: readonly SortRule[]
  readonly query: QueryAst | null
  readonly globalFilter: string
  readonly pageIndex: number
  /** `null` renders every filtered row -- the right setting when virtualising. */
  readonly pageSize: number | null
}

export interface PipelineOptions {
  readonly caseSensitive?: boolean
  readonly locale?: string
}

export interface PipelineResult<T> {
  /** Rows passing both filters, in source order. Drives "N of M" counts. */
  readonly filtered: readonly T[]
  /** `filtered`, ordered. Also the "select all" set. */
  readonly sorted: readonly T[]
  /** The rows to render: one page of `sorted`, or all of it when unpaginated. */
  readonly rows: readonly T[]
  readonly pageCount: number
  /** The requested index, clamped to a page that exists. */
  readonly pageIndex: number
}

export function runPipeline<T>(
  rows: readonly T[],
  columns: readonly ColumnDef<T>[],
  state: TableState,
  options: PipelineOptions = {},
): PipelineResult<T> {
  const filtered = filterRows(rows, columns, {
    query: state.query,
    globalFilter: state.globalFilter,
    caseSensitive: options.caseSensitive === true,
  })

  const sorted = sortRows(filtered, state.sort, columns, { locale: options.locale })

  if (state.pageSize === null) {
    return { filtered, sorted, rows: sorted, pageCount: 1, pageIndex: 0 }
  }

  const pageCount = pageCountFor(sorted.length, state.pageSize)
  const pageIndex = clampPageIndex(state.pageIndex, pageCount)

  return {
    filtered,
    sorted,
    rows: paginateRows(sorted, pageIndex, state.pageSize),
    pageCount,
    pageIndex,
  }
}
