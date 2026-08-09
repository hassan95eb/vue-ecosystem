/**
 * Filtering. Two independent mechanisms, deliberately kept apart:
 *
 * 1. **The structured filter** -- a `query-builder` AST. Every row is projected
 *    into a plain record keyed by column id and handed to that package's
 *    `evaluate()`. The AST traversal, the missing-value rules and the
 *    case-folding are *not* reimplemented here; that is the entire reason
 *    `query-builder` exports `evaluate` from its root. If this file ever grows
 *    an `if (node.type === 'group')`, something has gone wrong.
 * 2. **The global filter** -- one free-text box across every searchable column.
 *    It is not expressible as an AST (it is an implicit `or` over columns whose
 *    kinds differ), it is the single most-used table affordance, and it is
 *    twenty lines. Both filters apply; a row must pass both.
 */

import {
  evaluate,
  type EvaluateOptions,
  type QueryAst,
  type QueryRecord,
} from '@vue-ecosystem/query-builder'
import { getCellValue, type ColumnDef } from './columns'

export interface FilterOptions {
  /** The structured filter. `null` or an empty group matches every row. */
  readonly query?: QueryAst | null
  /** Free-text term. Empty or whitespace-only matches every row. */
  readonly globalFilter?: string
  /**
   * Passed through to `evaluate()` and used by the global filter. Defaults to
   * `false`, matching `query-builder`: a search box that misses `Ali` because
   * the user typed `ali` is a bug report, not a feature.
   */
  readonly caseSensitive?: boolean
}

/**
 * Project a row into the record `evaluate()` reads.
 *
 * Keyed by column **id**, not by the row's own property names -- that is what
 * makes a computed column (`accessor: (row) => row.first + ' ' + row.last`)
 * filterable on equal terms with a plain one. Columns with
 * `filterable: false` are left out, so their ids are absent from the record
 * exactly as they are absent from the derived schema.
 */
export function toQueryRecord<T>(row: T, columns: readonly ColumnDef<T>[]): QueryRecord {
  const record: Record<string, unknown> = {}
  for (const column of columns) {
    if (column.filterable === false) continue
    record[column.id] = getCellValue(column, row)
  }
  return record
}

/**
 * Does a row contain `term` in any searchable column?
 *
 * Substring, not fuzzy and not word-boundary: those need a ranking model to be
 * useful, and a ranking model belongs in a search package rather than in a
 * table. Values are stringified with `String()`; `Date` therefore matches on
 * its own `toString()`, which is locale-shaped and rarely what a user typed --
 * give date columns an `accessor` returning a formatted string if you want them
 * searchable, or set `searchable: false`.
 */
export function matchesGlobalFilter<T>(
  row: T,
  columns: readonly ColumnDef<T>[],
  term: string,
  caseSensitive = false,
): boolean {
  const needle = caseSensitive ? term : term.toLowerCase()
  if (needle.length === 0) return true

  return columns.some((column) => {
    if (column.searchable === false) return false

    const value = getCellValue(column, row)
    if (value === null || value === undefined) return false

    const haystack = String(value)
    return (caseSensitive ? haystack : haystack.toLowerCase()).includes(needle)
  })
}

/**
 * Apply both filters, preserving source order.
 *
 * Order preservation is not incidental: the sort that runs next is stable, so
 * rows equal under every sort rule stay in the order the data arrived in.
 */
export function filterRows<T>(
  rows: readonly T[],
  columns: readonly ColumnDef<T>[],
  options: FilterOptions = {},
): T[] {
  const query = options.query ?? null
  const term = (options.globalFilter ?? '').trim()
  const caseSensitive = options.caseSensitive === true

  if (query === null && term.length === 0) return [...rows]

  const evaluateOptions: EvaluateOptions = { caseSensitive }

  return rows.filter((row) => {
    if (term.length > 0 && !matchesGlobalFilter(row, columns, term, caseSensitive)) return false
    if (query !== null && !evaluate(query, toQueryRecord(row, columns), evaluateOptions)) {
      return false
    }
    return true
  })
}
